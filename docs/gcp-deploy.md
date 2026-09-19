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
export REPOSITORY="eco-grid-ems"
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

## 3. 建立兩個 service account

| 帳戶 | 身分 | 權限 |
|---|---|---|
| `github-deployer` | GitHub Actions 送出建置，**同時也是 Cloud Build 執行步驟的身分** | 部署需要的全部（§4） |
| `eco-grid-runtime` | Cloud Run 服務執行時的身分 | **刻意零權限** |

為什麼不用 Cloud Build 預設的執行帳戶：沒特別指定時，Cloud Build 會用專案的 **Compute Engine
預設帳戶**執行，而 Cloud Run 服務沒指定身分時**也**會用它。給它部署權限的結果，是對外開放的那支
伺服器也拿到「重新部署自己、推任意映像」的能力。所以兩者都明確指定（見 `server/cloudbuild.yaml`
與 workflow 的 `--service-account`），Compute Engine 預設帳戶完全不碰。

另外，「送出建置的帳戶」與「執行建置的帳戶」分開並不會帶來多少保護——能送出建置的人，
就能叫 Cloud Build 以執行帳戶的權限跑任意步驟。所以直接合併成一個，把真正的界線畫在
「部署者」與「被部署的程式」之間。

```bash
# 已在 Console 建過 github-deployer 的話，這行會回報已存在，略過即可
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions 部署與 Cloud Build 執行"

gcloud iam service-accounts create eco-grid-runtime \
  --display-name="Cloud Run 執行身分（零權限）"

export DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
export RUNTIME="eco-grid-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
```

`eco-grid-runtime` 建完就好，**不要給它任何角色**。伺服器只做模擬推播與代抓台電公開資料，
不呼叫任何 GCP API。

## 4. 授權 github-deployer

專案層級的角色：

```bash
for ROLE in roles/cloudbuild.builds.editor \
            roles/storage.admin \
            roles/artifactregistry.writer \
            roles/run.admin \
            roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER}" --role="$ROLE" --condition=None
done
```

「服務帳戶使用者」**綁在兩個帳戶上**，不給專案層級：

```bash
for SA in "$DEPLOYER" "$RUNTIME"; do
  gcloud iam service-accounts add-iam-policy-binding "$SA" \
    --member="serviceAccount:${DEPLOYER}" --role=roles/iam.serviceAccountUser
done
```

| 角色 | Console 名稱 | 為什麼需要 |
|---|---|---|
| `cloudbuild.builds.editor` | Cloud Build 編輯者 | 送出建置 |
| `storage.admin` | Storage 管理員 | `gcloud builds submit` 要把原始碼上傳到 `gs://${PROJECT_ID}_cloudbuild`（第一次自動建立），執行建置時再讀回來。bucket 建好後可收斂成只對該 bucket 的 `storage.objectAdmin` |
| `artifactregistry.writer` | Artifact Registry 寫入者 | 推映像 |
| `run.admin` | Cloud Run 管理員 | 部署服務。`--allow-unauthenticated` 要修改服務的 IAM 政策，「開發人員」角色做不到；也涵蓋 workflow 最後讀服務網址那一步 |
| `logging.logWriter` | 記錄寫入者 | `server/cloudbuild.yaml` 設了 `logging: CLOUD_LOGGING_ONLY`，以自訂帳戶執行時這是必要的 |
| `iam.serviceAccountUser`（綁在 `github-deployer` 上） | 服務帳戶使用者 | 讓建置能「以自己的身分」執行（`--service-account` 指向自己也要這個權限） |
| `iam.serviceAccountUser`（綁在 `eco-grid-runtime` 上） | 服務帳戶使用者 | 部署時把服務的執行身分設成 `eco-grid-runtime` |

服務帳戶使用者若給在專案層級，`github-deployer` 就能冒用專案內**任何**服務帳戶——包含日後
為其他用途建立、權限更大的帳戶。所以只綁在需要的兩個上。

在 Console 上操作的話：專案層級角色在 **IAM** 頁面編輯 `github-deployer` 那一列加入；服務帳戶使用者
則是到 **服務帳戶** 頁面，分別點進 `github-deployer` 與 `eco-grid-runtime` →「具備存取權的主體」
→「授予存取權」，主體填 `github-deployer` 的電子郵件、角色選「服務帳戶使用者」。

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
gcloud builds submit --config server/cloudbuild.yaml --ignore-file server/.gcloudignore --service-account "projects/${PROJECT_ID}/serviceAccounts/${DEPLOYER}"
```

兩個參數都不能省：`--ignore-file` 是因為 gcloud 預設只找上傳來源根目錄的 `.gcloudignore`；
`--service-account` 不帶的話會以 Compute Engine 預設帳戶執行，那個帳戶沒有部署權限，會失敗（§3）。

## 收尾

不想留著的話：

```bash
gcloud run services delete "$SERVICE" --region "$REGION"
gcloud artifacts repositories delete "$REPOSITORY" --location="$REGION"
```
