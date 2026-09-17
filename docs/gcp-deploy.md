# 把 server/ 部署到 Cloud Run

`server/` 原本只在開發環境跑，現在改成容器化後部署到 GCP，讓線上展示也有即時資料。
整條線是 **Cloud Build 建置 → Artifact Registry 存映像 → Cloud Run 執行 → Cloud Logging 收 log**，
由 [.github/workflows/deploy-cloud-run.yml](../.github/workflows/deploy-cloud-run.yml) 在
`server/**` 有異動時自動觸發。

這份文件記錄 **GCP 那側只需要做一次** 的設定。做完之後平常只要推 code。

---

## 0. 前置

- 一個 GCP 專案，且**已啟用帳單帳戶**——Always Free 額度要有有效帳單帳戶才會生效。
- 本機裝好 [gcloud CLI](https://cloud.google.com/sdk/docs/install) 並 `gcloud auth login`。

> **這份文件的指令都是 bash**（`export`、`$(...)`、heredoc），貼進 PowerShell 或 cmd 會直接壞掉。
> 在 Windows 上請用 **Git Bash**（裝了 Git 就有）或 **WSL**；最省事的是 **GCP Cloud Shell**——
> 在 Cloud Console 右上角點終端機圖示，gcloud 已經裝好也登入好了，連第一項前置作業都省了。

下面所有指令共用這組變數，先設好：

```bash
export PROJECT_ID="你的專案 ID"
export REGION="us-central1"
export REPOSITORY="eco-grid"
export SERVICE="eco-grid-server"
export GITHUB_REPO="usyuan/eco-grid-ems"

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

> **地區不要改成 asia-east1。** Cloud Run 的免費運算額度按 Tier 1 地區計價，
> 對外流量的免費額度又只算北美，換去台灣延遲會變好但兩項都拿不到。

## 1. 啟用 API

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  logging.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

## 2. 建立 Artifact Registry repository

```bash
gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="EcoGrid EMS 容器映像"
```

**同時設清理政策**。免費額度只有 0.5 GB，這個映像約 55 MB／版，不清的話大概九次部署就會開始計費：

```bash
cat > /tmp/cleanup-policy.json <<'JSON'
[
  { "name": "keep-recent",
    "action": { "type": "Keep" },
    "mostRecentVersions": { "keepCount": 3 } },
  { "name": "delete-old",
    "action": { "type": "Delete" },
    "condition": { "olderThan": "30d" } }
]
JSON

gcloud artifacts repositories set-cleanup-policies "$REPOSITORY" \
  --location="$REGION" \
  --policy=/tmp/cleanup-policy.json \
  --no-dry-run
```

（`--no-dry-run` 一定要加，否則政策只會記錄「本來會刪什麼」而不實際刪。）

## 3. 授權 Cloud Build

實際做 `docker push` 與 `gcloud run deploy` 的是 Cloud Build 的預設 service account。
新專案用的是 Compute Engine 預設 SA，較早建立的專案是 `<專案編號>@cloudbuild.gserviceaccount.com`，
兩個都授權最省事（不存在的那個會失敗，直接忽略）：

```bash
for SA in "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
          "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"; do
  for ROLE in roles/artifactregistry.writer \
              roles/run.admin \
              roles/iam.serviceAccountUser \
              roles/logging.logWriter; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${SA}" --role="$ROLE" \
      --condition=None --quiet || true
  done
done
```

| 角色 | 為什麼需要 |
|---|---|
| `artifactregistry.writer` | 推映像 |
| `run.admin` | 建立／更新 Cloud Run 服務 |
| `iam.serviceAccountUser` | Cloud Run 服務本身要以某個 SA 身分執行，部署者必須能「代表」它 |
| `logging.logWriter` | `server/cloudbuild.yaml` 設了 `logging: CLOUD_LOGGING_ONLY`，build log 直接寫進 Cloud Logging |

## 4. 建立 GitHub Actions 用的 service account

```bash
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions 部署用"

export DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/cloudbuild.builds.editor \
            roles/storage.admin \
            roles/run.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER}" --role="$ROLE" --condition=None
done
```

`storage.admin` 是因為 `gcloud builds submit` 要把原始碼打包上傳到 `gs://${PROJECT_ID}_cloudbuild`
這個暫存 bucket（第一次會自動建立）。bucket 建好之後可以收斂成只對該 bucket 的
`roles/storage.objectAdmin`。`run.viewer` 是給 workflow 最後那步讀服務網址用的。

## 5. Workload Identity Federation（不存金鑰）

不要把 service account 的 JSON 金鑰貼進 GitHub Secrets——那是一把不會過期的鑰匙。
改成讓 GitHub 用自己的 OIDC token 換一組幾十分鐘就失效的憑證。

### 5-1. 先取得不可變的數字 ID

條件一律綁**數字 ID**，不綁名稱。理由是 GitHub 帳號改名後，舊的 username 會被釋出讓任何人
註冊——綁名稱的條件屆時會信任搶註的人。數字 ID 永不重用。

```bash
export REPO_ID="$(curl -sf "https://api.github.com/repos/${GITHUB_REPO}" | grep -m1 '^  "id"' | tr -dc 0-9)"
echo "REPO_ID=$REPO_ID"
```

必須是數字，空的就是抓失敗（repo 是私有的話 `curl` 讀不到，改用
`gh api repos/${GITHUB_REPO} --jq .id`，或直接在瀏覽器開 `https://api.github.com/repos/<owner>/<repo>` 看 `id` 欄位）。

### 5-2. 建立 pool 與 provider

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository_id == '${REPO_ID}'"
```

`--attribute-condition` 不是可選的——少了它，**任何人的任何 repo** 都能拿 GitHub 的 OIDC token
來換你的憑證，GCP 現在也會直接拒絕建立這種 provider。

綁 `repository_id` 一條就擋掉「別人的 repo」與「你名下其他 repo」，而且不受改名影響。
mapping 裡留著 `attribute.repository`（名稱）純粹是為了 GCP 稽核記錄上看得懂是哪個 repo。

這個條件**沒有**涵蓋的兩種情況，是刻意接受的取捨：

| 沒擋到 | 想擋的話加這段 |
|---|---|
| repo 被轉移給別人後，新擁有者繼承權限（轉移時 repo ID 不變） | `&& assertion.repository_owner_id == '<owner id>'` |
| 從 `main` 以外的分支部署 | `&& assertion.ref == 'refs/heads/main'` |

條件寫錯或日後要收緊／放寬，用 `gcloud iam workload-identity-pools providers update-oidc`
改即可，不用重建 provider。

### 5-3. 繫結 service account

只允許這一個 repo 冒用部署用的 service account。這裡同樣綁數字 ID——前面條件鎖得再緊，
這一步若是綁名稱就前功盡棄：

```bash
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_id/${REPO_ID}"
```

取得要填進 GitHub 的 provider 完整資源名稱：

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global --workload-identity-pool=github --format='value(name)'
```

## 6. 設定 GitHub repo

Settings → Secrets and variables → Actions：

| 類型 | 名稱 | 值 |
|---|---|---|
| Secret | `GCP_WIF_PROVIDER` | 上一步 describe 出來的 `projects/.../providers/github-provider` |
| Secret | `GCP_SERVICE_ACCOUNT` | `github-deployer@<PROJECT_ID>.iam.gserviceaccount.com` |
| Variable | `GCP_PROJECT_ID` | 專案 ID |
| Variable | `CLIENT_ORIGIN` | 選填。預設 `https://usyuan.github.io`，只有換網域才要設 |
| Variable | `VITE_SERVER_URL` | **第一次部署完成後**才填，見下一節 |

## 7. 第一次部署

推一個動到 `server/**` 的 commit，或直接在 Actions 頁面手動觸發
**Deploy server to Cloud Run**。跑完後 job summary 會印出服務網址，長得像
`https://eco-grid-server-xxxxxxxxxx-uc.a.run.app`。

如果卡在「取得 GCP 憑證」那一步、訊息提到 `rejected by the attribute condition`，
就是第 5-2 節的條件對不上：確認 `REPO_ID` 抓到的是數字、而且與 provider 上設的一致。改條件用：

```bash
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --location=global --workload-identity-pool=github \
  --attribute-condition="..."
```

驗證：

```bash
curl "$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')/health"
# {"status":"ok","uptime":...}
```

然後回 GitHub 把 Variable `VITE_SERVER_URL` 設成那個網址，
**再手動重跑一次 Deploy client to GitHub Pages**——改 variable 不會自動觸發前端建置。
重新部署後線上站的電網頻率圖、設備清單與告警就會開始跳動。

## 8. 看 log（Cloud Logging）

`server/src/logger.ts` 在 `NODE_ENV=production` 時會把每一行印成單行 JSON，
Cloud Logging 會解析成結構化欄位，因此可以直接按嚴重性篩。Logs Explorer 查詢範例：

```text
resource.type="cloud_run_revision"
resource.labels.service_name="eco-grid-server"
severity>=WARNING
```

```bash
# 直接用 CLI 看最近 50 筆
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="eco-grid-server"' \
  --limit=50 --format='table(timestamp, severity, jsonPayload.message)'

# build log
gcloud logging read 'resource.type="build"' --limit=20
```

台電代抓失敗會以 `severity=ERROR`／`WARNING` 出現在這裡。免費額度 50 GiB／月，這個服務用不到。

## 9. 免費額度與成本守則

| 服務 | 免費額度（每月） | 這個專案會用到多少 |
|---|---|---|
| Artifact Registry | 0.5 GB | 約 55 MB／版，清理政策留 3 版 |
| Cloud Build | 2,500 build-minutes（e2-standard-2） | 每次約 2–3 分鐘 |
| Cloud Run | 180,000 vCPU-秒、360,000 GiB-秒、200 萬請求、1 GB 北美流量 | **見下** |
| Cloud Logging | 50 GiB | 極少 |

Cloud Run 的瓶頸是 vCPU-秒，不是請求數：**只要有任何一條 WebSocket 開著，instance 就算 active，
CPU 全程計費**。以 1 vCPU 計，180,000 vCPU-秒 ≈ **每月 50 小時的實際連線時間**。
當作作品集展示很夠用，但不要讓瀏覽器分頁整天掛著。超出後約 US$0.09／小時。

會讓你離開免費額度的操作，**都不要做**：

- `--min-instances` 設成 1 以上（等於 24/7 計費）
- 加 `--no-cpu-throttling` / CPU always allocated（切成 instance-based 計費，閒置也算）
- 在 `server/cloudbuild.yaml` 指定 `machineType`（免費額度只涵蓋預設的 e2-standard-2）
- 用 Cloud Scheduler 之類的東西定時 ping 保溫

建議另外到 Billing → Budgets & alerts 設一個 US$1 的預算警示（免費）。服務是公開的，
任何人都能開連線消耗額度，`--max-instances=1` 只是天花板不是防護。

## 10. 本機跑一次完整 Docker 流程

不需要 GCP 也能驗證映像本身。**一律從 repo 根目錄執行**——build context 是根目錄不是
`server/`（pnpm 的 lockfile 在那）：

```bash
docker build -f server/Dockerfile -t eco-grid-server .
docker run --rm -p 4000:8080 -e CLIENT_ORIGIN=http://localhost:5173 eco-grid-server
curl http://localhost:4000/health
```

容器內固定聽 8080（Cloud Run 用 `$PORT` 指定），對外映到 4000 就能沿用前端的預設設定。

排除清單是 [server/Dockerfile.dockerignore](../server/Dockerfile.dockerignore)，不是根目錄的
`.dockerignore`。這種「與 Dockerfile 同層、以 Dockerfile 檔名為前綴」的命名**只有 BuildKit 認得**；
Docker Desktop 預設就是 BuildKit，所以本機不用額外設定。想確認它真的生效，看 build 輸出第一行
`transferring context` 的大小——應該是幾百 KB，不是幾百 MB。

也可以不推 commit、直接從本機送一次 Cloud Build（會真的建置並部署）：

```bash
gcloud builds submit --config server/cloudbuild.yaml --ignore-file server/.gcloudignore
```

`--ignore-file` 不能省——gcloud 預設只找上傳來源根目錄的 `.gcloudignore`，我們那份在 `server/` 底下。

## 收尾

不想留著的話：

```bash
gcloud run services delete "$SERVICE" --region "$REGION"
gcloud artifacts repositories delete "$REPOSITORY" --location="$REGION"
```
