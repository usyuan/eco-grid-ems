# syntax=docker/dockerfile:1

# build context 是 **repo 根目錄**，不是 server/——pnpm 的 lockfile 與 workspace 設定都在那裡。
# 因此所有 COPY 路徑以根目錄為基準，建置指令要寫成：
#   docker build -f server/Dockerfile -t eco-grid-server .

ARG NODE_VERSION=22-alpine
# 要與產生 pnpm-lock.yaml（lockfileVersion 9.0）的 pnpm 對齊，版本差太多會讓 --frozen-lockfile 失敗。
# 升級本機 pnpm 時記得一起改這裡。
ARG PNPM_VERSION=11.25.0

# ---- base：只放 manifest，讓 install 這層在改動原始碼時仍能命中 build cache ----
FROM node:${NODE_VERSION} AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
# 這三份加上 server/package.json 就是 --frozen-lockfile 需要的全部；
# client/ 完全不用進來（pnpm 不會因為 workspace 少一個 importer 就拒絕安裝，實測過）。
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY server/package.json server/

# ---- build：裝完整相依（含 typescript）後編譯 ----
FROM base AS build
RUN pnpm install --frozen-lockfile --filter server
COPY server/tsconfig.json server/
COPY server/src server/src
RUN pnpm --filter server build

# ---- prod-deps：只裝 runtime 相依，tsx／typescript 不進最終映像 ----
FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --filter server --prod

# ---- runtime ----
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run 會以 $PORT 覆蓋這個值（實際是 8080），這裡只是讓本機 docker run 有一致的預設
ENV PORT=8080

# pnpm 的 server/node_modules 全是 symlink，指向 workspace 根目錄的 node_modules/.pnpm，
# 兩個目錄都要複製過來才解析得到套件。
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY server/package.json ./server/

# node 這個非 root 使用者由官方映像提供
USER node
WORKDIR /app/server
EXPOSE 8080
CMD ["node", "dist/index.js"]
