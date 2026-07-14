# 万卷回响 部署文档

> 覆盖:生产环境整体部署 / 三个前端(H5、WeApp、RN App)的构建与发布 / 环境变量与域名配置 / MySQL 数据库初始化与维护。

***

## 0. 架构总览

```
                    ┌────────────────────────────────────┐
                    │           Cloud / Server           │
                    │                                    │
   WeApp  ─────┐    │   ┌──────────────────────────┐     │
   RN App ─────┼────┼──▶│   nginx (admin) :5174    │─────┼──▶ NestJS Server :3000 ──▶ MySQL 8 :3306
   Browser ────┘    │   │  /api/* → server:3000    │     │     (Prisma)              (qingmalaya)
                    │   │  /static/* → server:3000│     │     /uploads 持久化卷
                    │   └──────────────────────────┘     │
                    │   ┌──────────────────────────┐     │
                    │   │  nginx (mobile H5) :10086│     │
                    │   │  /api/* → server:3000   │     │
                    │   └──────────────────────────┘     │
                    └────────────────────────────────────┘
```

| 端         | 技术栈                                    | 构建产物                            | 运行方式                       |
| --------- | -------------------------------------- | ------------------------------- | -------------------------- |
| Server    | NestJS 10 + Prisma 5 + MySQL 8         | `apps/server/dist`              | node / docker              |
| Admin     | React 18 + Vite + Ant Design Pro       | `apps/admin/dist`               | nginx 静态托管                 |
| Mobile H5 | Taro 4.2 (React → H5 webpack5)         | `apps/mobile/dist`              | nginx 静态托管                 |
| WeApp     | Taro 4.2 (React → 微信小程序)               | `apps/mobile/dist` (type=weapp) | 微信开发者工具上传                  |
| RN App    | Taro 4.2 + React Native 0.73 + Expo 50 | `apps/mobile/dist` (type=rn)    | Expo / EAS / 本地打 APK / IPA |

所有端共享 `@qingmalaya/shared` 包(枚举、类型、Zod schema),由 server 端通过 `dist` 解析,前端通过源码路径(由各 webpack/Metro 规则)解析。

> **AI 语音转文字(ASR)**:播放页的"文稿"功能依赖阿里云百炼 DashScope API(`fun-asr` 模型)。server 端将本地音频上传至 DashScope 临时 OSS → 提交异步转写任务 → 轮询结果 → 缓存到 `Podcast.transcript` JSON 字段。需配置 `DASHSCOPE_API_KEY`,否则文稿功能不可用(不影响其他功能)。

***

## 1. 环境前置

| 工具                   | 版本要求                   | 用途                                 |
| -------------------- | ---------------------- | ---------------------------------- |
| Node.js              | ≥ 20 LTS(推荐 20.x)      | 构建所有前端 + server                    |
| pnpm                 | 9+ (推荐 10.33.0)        | 仓库固定 `packageManager`              |
| Docker               | 24+                    | 生产环境推荐部署方式                         |
| Docker Compose       | v2+ (`docker compose`) | 编排 mysql / server / admin / mobile |
| MySQL 客户端(可选)        | 8.0+                   | 调试 / 备份                            |
| 微信开发者工具              | 最新稳定版                  | WeApp 上传 / 预览                      |
| Xcode + CocoaPods    | 15+ / 1.14+            | iOS 打包(可选)                         |
| Android Studio + JDK | Hedgehog / 17          | Android 打包(可选)                     |

> 项目根 `package.json` 中 `packageManager` 锁定了 `pnpm@10.33.0`,本机与 CI 都用同一版本可避免 lockfile 漂移。

***

## 2. 配置文件总览

部署时一定会触碰的文件/路径:

| 路径                                                   | 作用                        | 何时改             |
| ---------------------------------------------------- | ------------------------- | --------------- |
| `docker-compose.yml`                                 | 一键编排 4 个容器                | 改端口、卷、环境变量      |
| `apps/server/.env` (或 `.env.example`)                | server 运行时配置              | 改域名/DB/JWT/上传限制/ASR |
| `apps/server/Dockerfile`                             | server 镜像构建               | 极少改             |
| `apps/admin/nginx.conf`                              | admin 的 nginx + `/api` 反代 | 改反代目标           |
| `apps/mobile/nginx.conf`                             | mobile H5 的 nginx         | 改反代目标           |
| `apps/mobile/src/utils/request.ts` 里的 `API_BASE_URL` | mobile H5 调用后端的根地址        | **生产部署必须改**     |
| `apps/mobile/config/weapp.ts`                        | 微信小程序目标配置                 | 改输出目录/AppID 时   |
| `apps/mobile/dist/project.config.json`               | 微信小程序工程配置(由 weapp 构建自动生成) | 首次构建后填 AppID    |
| `docker/mysql/init/01-grants.sql`                    | MySQL 初始化权限               | 改密码/授权          |

***

## 3. 本地构建(不依赖 Docker)

> 适合调试单个端、或准备把构建产物手工拷贝到服务器的场景。

### 3.1 一次性准备

```bash
# 1) 装依赖
pnpm install

# 2) 编译 shared 包(server/admin/mobile 都依赖)
pnpm --filter @qingmalaya/shared build
```

> 任何时候改了 `packages/shared/src/**`,都必须重新 `pnpm --filter @qingmalaya/shared build` —— server 的 tsconfig 把 `@qingmalaya/shared` alias 指向 `packages/shared/dist`,不重新构建 server 会拿到旧类型甚至 TS6059 报错。

### 3.2 构建并启动 Server

```bash
# 1) 准备数据库(下文第 5 节详解)
docker compose up -d mysql
pnpm --filter @qingmalaya/server prisma:migrate
pnpm --filter @qingmalaya/server prisma:seed

# 2) 启动 dev 模式(热更新)
pnpm --filter @qingmalaya/server dev
#   → http://localhost:3000/api

# 3) 或构建生产产物
pnpm --filter @qingmalaya/server build       # → apps/server/dist
node apps/server/dist/main.js                # 需先 .env 配好 DATABASE_URL
```

### 3.3 构建 Admin

```bash
# 开发
pnpm --filter @qingmalaya/admin dev          # → http://localhost:5174
# 生产构建
pnpm --filter @qingmalaya/admin build        # → apps/admin/dist(纯静态)
# 预览构建产物
pnpm --filter @qingmalaya/admin preview      # vite preview
```

Admin 的 `vite.config.ts` 已经把 `/api` 与 `/static` 反代到 `http://localhost:3000`,因此构建产物**部署到任意带 nginx 的服务器**后,只需让 nginx 也把这两个前缀反代到 server 即可,无需改前端代码。

### 3.4 构建 Mobile H5

```bash
# 开发
pnpm --filter @qingmalaya/mobile dev:h5      # → http://localhost:10086
# 生产构建
pnpm --filter @qingmalaya/mobile build:h5    # → apps/mobile/dist
```

构建前**务必**确认 `apps/mobile/src/utils/request.ts` 中的 `API_BASE_URL` 已改为生产域名,例如:

```ts
export const API_BASE_URL = 'https://api.example.com/api'
//                  ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
//  改成你自己的 HTTPS 域名,或相对路径 '/api'(此时依赖 nginx /api 反代)
```

> 备选:把 `API_BASE_URL` 改成相对路径 `/api`,并让部署 mobile H5 的 nginx 把 `/api` 反代到 server(代码里这段反代配置已存在于 `apps/mobile/nginx.conf`,只需启用即可)。这种部署下 H5 与后端同源,无 CORS 烦恼。

### 3.5 构建 WeApp(微信小程序)

```bash
pnpm --filter @qingmalaya/mobile build:weapp
# 产物目录:apps/mobile/dist
```

构建产物 `apps/mobile/dist` 即可直接用**微信开发者工具**"导入项目"打开:

1. 微信开发者工具 → 导入项目 → 选 `apps/mobile/dist` 目录
2. AppID:首次导入时填入(可在 `project.config.json` 里预设,见下)
3. 工具内点击右上角"上传" → 填版本号与项目备注 → 提交审核

**首次需要做的额外配置(每个开发者账号只做一次):**

1. 在 `apps/mobile/dist/project.config.json` 里设置 `appid`(运行 `taro build --type weapp` 后会自动生成该文件,改里面的 `appid` 字段即可,后续构建都会保留):
   ```json
   {
     "appid": "wx0123456789abcdef",
     "projectname": "qingmalaya-mobile",
     ...
   }
   ```
2. 登录 [微信公众平台](https://mp.weixin.qq.com) → 开发管理 → 开发设置:
   - **服务器域名**:`request 合法域名` 添加 `https://api.example.com` 与 `https://static.example.com`(用于播放音频 / 显示封面)
   - **uploadFile 合法域名**:同上
   - **downloadFile 合法域名**:同上
   - 勾选 "不校验合法域名、web-view(业务域名)、TLS 版本以及 HTTPS 证书" 仅用于本地调试,生产环境**必须**取消勾选
3. 业务域名(若 H5 内嵌在 web-view):开发管理 → 开发设置 → 业务域名 → 配置下载校验文件

> ⚠️ 微信小程序**仅支持 HTTPS** 域名,所有 API 与静态资源必须走 https。HTTP 会被微信客户端拒绝请求。

### 3.6 构建 RN App(Android / iOS)

RN 端构建比 H5 复杂得多,项目里只配置了 Metro + Expo 50,推荐用 EAS(Expo Application Services)托管构建:

```bash
# 安装 EAS CLI(全局一次)
npm i -g eas-cli

# 登录 Expo 账号
eas login

# 在 apps/mobile 目录下初始化(若尚无 eas.json)
cd apps/mobile
eas build:configure

# 触发云端构建
eas build -p android --profile production     # Android AAB/APK
eas build -p ios --profile production         # iOS IPA(需 Apple 开发者账号)
```

也可以本地构建,但需要本机装齐 Android SDK / Xcode / CocoaPods:

```bash
pnpm --filter @qingmalaya/mobile build:rn
# 产物在 apps/mobile/dist
# Android: cd android && ./gradlew assembleRelease
# iOS:     cd ios && pod install && open *.xcworkspace → Xcode 打包
```

***

## 4. 生产部署(Docker Compose 一键)

> 这是推荐方式:一份 compose 把 MySQL、Server、Admin(H5 反代)、Mobile H5 全管起来。

### 4.1 启动前必改项

打开 `docker-compose.yml`,至少改两处:

```yaml
services:
  server:
    environment:
      # 1) 数据库地址:用容器名 'mysql',Docker 内部 DNS 解析,不要改成 localhost
      DATABASE_URL: 'mysql://qingmalaya:qingmalaya123@mysql:3306/qingmalaya'
      # 2) JWT 密钥:必须改!改成 64 位随机串
      JWT_SECRET: 'GENERATE-A-64-BYTE-RANDOM-STRING-HERE'
      # 3) AI 语音转文字(阿里云百炼 DashScope)— 不填则文稿功能不可用
      DASHSCOPE_API_KEY: 'sk-ws-xxxxxxxxxxxxx'
      DASHSCOPE_BASE_URL: 'https://ws-um5sso2u7rtdjsel.cn-beijing.maas.aliyuncs.com/api/v1'
      # 4) server 对外可访问的基础 URL(ASR 需要用到,也可用于其他场景)
      PUBLIC_BASE_URL: 'https://api.example.com'
```

`JWT_SECRET` 建议这样生成:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> MySQL 用户名/密码与 `docker/mysql/init/01-grants.sql` 必须保持一致;改了 compose 里的密码,init 脚本要同步改(或者干脆先 `docker compose down -v` 再起)。
>
> `DASHSCOPE_API_KEY` 在阿里云百炼控制台获取([获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key))。`DASHSCOPE_BASE_URL` 中的 workspace ID(`ws-um5sso2u7rtdjsel`)需替换为你自己的百炼工作空间 ID。`PUBLIC_BASE_URL` 必须是公网可访问的地址,因为 ASR 任务提交后阿里云需要能访问到音频文件。

### 4.2 首次启动

```bash
# 在仓库根目录
docker compose up -d --build
```

启动后会自动:

1. 拉起 `mysql` 容器,执行 `docker/mysql/init/01-grants.sql` 授权
2. 等待 mysql 健康检查通过
3. 构建 `server` 镜像 → 运行 `npx prisma migrate deploy` 应用迁移 → 启动 `node dist/main.js`
4. 构建并启动 `admin`、`mobile`(nginx)

查看日志:

```bash
docker compose logs -f server      # 看迁移是否成功
docker compose ps                  # 看 4 个容器是否都 healthy
```

### 4.3 首次数据初始化(seed)

`prisma migrate deploy` 只会建表,不会写示例数据。**首次部署**完成后跑一次 seed:

```bash
docker compose exec server npx ts-node prisma/seed.ts
# 或
pnpm --filter @qingmalaya/server prisma:seed
```

默认会创建:

| 角色           | 学号         | 密码            |
| ------------ | ---------- | ------------- |
| SUPER\_ADMIN | `admin`    | `admin123`    |
| OPERATOR     | `operator` | `operator123` |

> 🚨 **生产部署完成后第一时间改掉这两个账号的密码**(在 Admin 后台 → 用户管理),并修改 `JWT_SECRET`。

### 4.4 验证服务

| 地址                      | 期望                            |
| ----------------------- | ----------------------------- |
| `http://服务器IP:3000/api` | 见到 NestJS 启动日志 / Swagger(若开启) |
| `http://服务器IP:5174`     | Admin 后台登录页                   |
| `http://服务器IP:10086`    | Mobile H5 启动页                 |
| 浏览器 Console             | H5 调用 `/api` 不报 CORS / 404    |

***

## 5. 数据库(MySQL 8)详解

### 5.1 部署形态选择

| 形态                            | 适用场景             | 备注                                       |
| ----------------------------- | ---------------- | ---------------------------------------- |
| 容器内 MySQL(`qingmalaya-mysql`) | 快速验证 / 演示 / 单机部署 | 已编排在 compose 中                           |
| 外部托管 MySQL(阿里云 RDS、AWS RDS)   | **生产推荐**         | 改 `DATABASE_URL` 即可,无需改 schema           |
| 已有自建 MySQL                    | 内网/合规            | 同样的方式:只改 compose 里 `server.DATABASE_URL` |

容器内 MySQL 的密码见 `docker-compose.yml` 与 `docker/mysql/init/01-grants.sql`,**两者必须保持一致**;不一致会导致 `prisma migrate deploy` 失败。

### 5.2 数据库与用户

容器启动时由 `docker/mysql/init/01-grants.sql` 一次性授权(只在新库初始化时执行):

```sql
GRANT ALL PRIVILEGES ON *.* TO 'qingmalaya'@'%';
FLUSH PRIVILEGES;
```

> 之所以 `*.*`,是因为 Prisma 的 `prisma migrate dev` 命令需要 `shadowDatabaseUrl`(同实例下临时库)权限。**生产环境**用 `migrate deploy`(不走 shadow DB),可以把授权收窄到 `qingmalaya.*` —— 但要注意将来切回 `migrate dev` 时会再次失败。

### 5.3 创建第一次 Prisma 迁移

项目仓库里目前没有 `apps/server/prisma/migrations/`,意味着**还没有任何迁移文件**。在第一次部署时需要先基于 `schema.prisma` 生成初始化迁移:

```bash
# A) 容器内 MySQL 方式(在仓库根)
docker compose up -d mysql
DATABASE_URL="mysql://qingmalaya:qingmalaya123@localhost:3306/qingmalaya" \
  pnpm --filter @qingmalaya/server exec prisma migrate dev --name init

# 这会:
# 1) 把 schema.prisma 翻译成 SQL
# 2) 写入 apps/server/prisma/migrations/<timestamp>_init/migration.sql
# 3) 在 MySQL 中执行建表
# 4) 触发 prisma generate(更新 client)
```

提交 `apps/server/prisma/migrations/` 这个目录到 git(`.gitignore` 不要忽略它),后续部署 `prisma migrate deploy` 才能增量应用。

**之后**的 schema 改动流程:

```bash
# 修改 apps/server/prisma/schema.prisma
pnpm --filter @qingmalaya/server exec prisma migrate dev --name add_xxx
# 提交新生成的 migration.sql
```

线上发布时无需手动跑迁移,`server` 容器启动时会自动执行 `npx prisma migrate deploy`。

### 5.4 备份与恢复

```bash
# 备份
docker compose exec mysql sh -c 'mysqldump -uqingmalaya -pqingmalaya123 qingmalaya' \
  > "qingmalaya-$(date +%Y%m%d-%H%M%S).sql"

# 恢复
cat qingmalaya-20260711-103000.sql | docker compose exec -T mysql \
  mysql -uqingmalaya -pqingmalaya123 qingmalaya
```

如果是外部 RDS,直接用云厂商控制台 / `mysqldump` 即可,项目无 schema 之外的特殊依赖。

### 5.5 数据卷与持久化

`docker-compose.yml` 中已声明命名卷 `mysql_data`,删除容器不会丢数据:

```bash
docker compose down        # 停容器,保留数据
docker compose down -v     # 停容器+清掉 mysql_data(慎用!)
```

应用层 `apps/server/uploads/` 通过 bind mount 持久化(`./uploads:/app/uploads`),用户上传的封面、音频、Markdown 引用图片都在这里。**生产环境建议改成命名卷,避免误删**:

```yaml
volumes:
  - uploads_data:/app/uploads
volumes:
  uploads_data:
```

***

## 6. 域名、HTTPS、反向代理

### 6.1 推荐域名规划

| 子域名                  | 指向          | 说明                    |
| -------------------- | ----------- | --------------------- |
| `admin.example.com`  | admin:80    | 后台管理                  |
| `m.example.com`      | mobile:80   | 移动端 H5                |
| `api.example.com`    | server:3000 | 后端 API                |
| `static.example.com` | server:3000 | 用户上传的封面/音频(`/static`) |

DNS 把四个 A/AAAA 记录全部指向同一台服务器即可,nginx 在 443/80 上做按 Host 的转发。

### 6.2 HTTPS 证书(Let's Encrypt)

```bash
# 安装 certbot(以 Ubuntu/Debian 为例)
apt install -y certbot

# 申请 4 个域名的通配/独立证书
certbot certonly --standalone -d admin.example.com -d m.example.com \
  -d api.example.com -d static.example.com
# 或用 --nginx 插件
```

证书放在 `/etc/letsencrypt/live/<domain>/`,自动续期 `certbot renew --dry-run`。

### 6.3 外层 nginx 示例(部署在宿主机 80/443,转发到 docker 内部端口)

```nginx
# /etc/nginx/conf.d/qingmalaya.conf

# HTTP → HTTPS 跳转
server {
    listen 80;
    server_name admin.example.com m.example.com api.example.com static.example.com;
    return 301 https://$host$request_uri;
}

# Admin
server {
    listen 443 ssl http2;
    server_name admin.example.com;
    ssl_certificate     /etc/letsencrypt/live/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.com/privkey.pem;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# Mobile H5
server {
    listen 443 ssl http2;
    server_name m.example.com;
    ssl_certificate     /etc/letsencrypt/live/m.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/m.example.com/privkey.pem;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:10086;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# API
server {
    listen 443 ssl http2;
    server_name api.example.com;
    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# 静态资源(用户上传的封面/音频)
server {
    listen 443 ssl http2;
    server_name static.example.com;
    ssl_certificate     /etc/letsencrypt/live/static.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/static.example.com/privkey.pem;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;   # ServeStaticModule 挂在 /static
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 6.4 让前端指向正确域名

- **Admin**: `apps/admin/src/utils/request.ts` 中 `baseURL: '/api'` 是相对路径。`/api` 由 `apps/admin/nginx.conf` 反代到 server,只要保证宿主机 `admin.example.com` 的 80/443 反代到 admin 容器即可,**不需要改前端代码**。
- **Mobile H5**: `apps/mobile/src/utils/request.ts` 里 `API_BASE_URL` 当前硬编码 `http://localhost:3000/api`。**生产前必须改**,二选一:
  1. 改成 `https://api.example.com/api`(直连),简单但跨域,server 端 CORS 已默认 `origin: true` 放行;
  2. 改成 `/api`(相对),并让 mobile nginx 把 `/api` 反代到 server(`apps/mobile/nginx.conf` 已预留这段配置,只需启用)。这种是**同源部署**,微信内置浏览器 / Safari ITP 更友好。
- **WeApp**: 在 `project.config.json` 中配服务器域名(见 §3.5)。
- **RN App**: 在 `eas.json` 的 `extra.apiBaseUrl` 里配置,运行时注入到 `request.ts`(项目目前未抽象 env,需自行扩展)。

***

## 7. 环境变量速查表

### 7.1 Server(`apps/server/.env` / compose)

| 变量                   | 默认 (compose)                                             | 含义                |
| -------------------- | -------------------------------------------------------- | ----------------- |
| `NODE_ENV`           | `production`                                             | 运行时环境             |
| `PORT`               | `3000`                                                   | HTTP 监听端口         |
| `DATABASE_URL`       | `mysql://qingmalaya:qingmalaya123@mysql:3306/qingmalaya` | Prisma 数据库连接串     |
| `JWT_SECRET`         | `change-me-in-production-please`                         | **生产必改**,JWT 签名密钥 |
| `JWT_ACCESS_TTL`     | `2h`                                                     | access token 有效期  |
| `JWT_REFRESH_TTL`    | `7d`                                                     | refresh token 有效期 |
| `UPLOAD_DIR`         | `/app/uploads`                                           | 上传文件落盘目录          |
| `MAX_COVER_SIZE`     | `5242880`(5 MB)                                          | 封面图最大字节           |
| `MAX_AUDIO_SIZE`     | `209715200`(200 MB)                                      | 音频文件最大字节          |
| `MAX_AUDIO_DURATION` | `3600`(秒)                                                | 音频最大时长(秒)         |
| `DASHSCOPE_API_KEY`   | _(空,需手动填)_                                            | 阿里云百炼 API Key,用于 AI 语音转文字(ASR)。不填则文稿功能不可用 |
| `DASHSCOPE_BASE_URL`  | `https://ws-um5sso2u7rtdjsel.cn-beijing.maas.aliyuncs.com/api/v1` | DashScope API 地址,workspace ID 需替换为自己的 |
| `PUBLIC_BASE_URL`     | `http://localhost:3000`                                | server 对外可访问的基础 URL,ASR 转写需要公网可访问的音频地址 |

> `appConfig()` 启动时用 Zod 强校验,缺/错关键变量会直接拒启 —— 这是一道防线,不要绕过。`DASHSCOPE_API_KEY` 是 optional 的,不填不会阻止启动,但文稿功能会报 `DASHSCOPE_API_KEY is not configured`。

### 7.2 Admin / Mobile

这两个端没有运行时 env(全打包到 JS 里)。需要根据部署域名做以下修改:

| 端      | 文件                                             | 需要改的内容                    |
| ------ | ---------------------------------------------- | ------------------------- |
| Admin  | `apps/admin/src/utils/request.ts`              | `baseURL` 已是 `/api`,无需改   |
| Mobile | `apps/mobile/src/utils/request.ts`             | `API_BASE_URL` 生产域名       |
| WeApp  | `apps/mobile/dist/project.config.json` (构建产物里) | `appid` 字段                |
| RN     | `apps/mobile/eas.json`                         | `extra.apiBaseUrl` 等(若引入) |

***

## 8. 常用运维命令

```bash
# 拉取最新代码后重建并滚动重启
git pull
docker compose up -d --build

# 只重启 server
docker compose up -d --build server

# 查看 server 日志
docker compose logs -f --tail=200 server

# 进 server 容器
docker compose exec server sh

# 数据库迁移(线上)
docker compose exec server npx prisma migrate deploy

# 重新 seed(会重置示例数据;**慎用线上**)
docker compose exec server npx ts-node prisma/seed.ts

# 看 mysql 是否健康
docker compose ps

# 备份 / 恢复 见 §5.4

# 清理构建缓存(无依赖改动时重建)
docker builder prune
```

***

## 9. 上线 Checklist

- [ ] `JWT_SECRET` 改成 64 位随机串
- [ ] `mysql` 密码与 `01-grants.sql` 一致,生产环境收窄到只授权 `qingmalaya.*`(若放弃 `migrate dev` 流程)
- [ ] 跑通 `prisma migrate dev --name init` 并提交 `migrations/` 目录
- [ ] 首次启动后跑一次 `prisma:seed`
- [ ] 修改 `admin` / `operator` 默认密码
- [ ] `apps/mobile/src/utils/request.ts` 的 `API_BASE_URL` 指向生产域名(且为 HTTPS)
- [ ] WeApp 的 `project.config.json` 填入 AppID;微信公众平台 → 服务器域名白名单
- [ ] 申请并部署 4 个域名的 HTTPS 证书
- [ ] 配置外层 nginx,HTTP→HTTPS
- [ ] 防火墙/安全组:开放 80/443,关闭直接暴露的 3000/3306/5174/10086
- [ ] 上传目录改命名卷(`uploads_data:`)而不是 bind mount
- [ ] 配置定时备份(每日 mysqldump 到对象存储)
- [ ] 配置日志收集(可选 Loki / ELK)
- [ ] 监控 server 容器健康(`docker compose ps` / 探针)
- [ ] CORS:生产环境把 `app.enableCors({ origin: true })` 改为白名单(`https://admin.example.com`、`https://m.example.com`)
- [ ] `DASHSCOPE_API_KEY` 填入阿里云百炼 API Key(不填则 AI 文稿功能不可用)
- [ ] `DASHSCOPE_BASE_URL` 中的 workspace ID 替换为自己的百炼工作空间 ID
- [ ] `PUBLIC_BASE_URL` 设为公网可访问的 server 地址(如 `https://api.example.com`),ASR 需要公网访问音频

***

## 10. 故障排查速查

| 现象                                        | 排查方向                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `prisma migrate deploy` 报 `Access denied` | MySQL 用户名密码不一致,或授权未生效(执行 `01-grants.sql`)                                      |
| 容器起不来,server 日志 `JWT_SECRET is required`  | `.env` 没挂载进容器,或 compose 里没设 `JWT_SECRET`                                       |
| 客户端跨域报错                                   | server CORS 当前 `origin: true` 放行;若自定义了 origin 白名单,确认前端域名在白名单内                  |
| H5 调用 `/api` 404                          | `API_BASE_URL` 拼错;或 mobile nginx 没启用 `/api` 反代                                 |
| WeApp 上传后接口报 `不在以下 request 合法域名列表中`       | 微信公众平台 → 开发设置 → 服务器域名白名单,需 https                                               |
| Admin 登录提示网络异常                            | 浏览器控制台看具体错误;`/api` 走到 admin nginx 后被反代到 server,检查 server 是否在跑                  |
| 上传 200MB 音频被拒                             | nginx `client_max_body_size 200M;`、server `MAX_AUDIO_SIZE`、`Multer` 三处都要 ≥ 实际值 |
| 容器重启后数据丢失                                 | 用了 `docker compose down -v` 删了卷;或 bind mount 路径写错(检查 `./uploads` 在仓库根)         |
| 微信小程序无法播放音频                               | 音频域名必须在 `downloadFile 合法域名` 中,且为 https                                         |
| 播放页"文稿"按钮报 `DASHSCOPE_API_KEY is not configured` | `.env` 或 compose 中未设 `DASHSCOPE_API_KEY`,填入阿里云百炼 API Key 后重启 server            |
| 文稿状态一直 `processing` 不返回                      | 查看 `docker compose logs server` 是否有 ASR 报错;可能原因:API Key 无效、workspace ID 错误、音频文件过大、阿里云服务端超时 |
| 文稿状态 `failed`                                    | server 日志会记录具体 error;常见原因:音频格式不支持、OSS 临时上传失败、DashScope 余额不足           |
| `DASHSCOPE_BASE_URL` 配置后 ASR 仍失败               | URL 中的 workspace ID(`ws-xxxxx`)必须与你的百炼工作空间一致,且 API Key 属于同一地域            |

***

## 11. 部署后的功能验收

1. **Admin 端**:登录 → 创建班级/标签 → 审核一个 PENDING 播客 → 上线 Banner(类型 NONE/PLAYLIST/MARKDOWN 各试一次)
2. **H5 端**:发现页看到新 Banner → 进入精选集 → 打开 Markdown 内容页 → 播客详情 → 播放/点赞/收藏 → 个人中心资料完整
3. **WeApp**:在微信开发者工具导入 → 真机扫码预览 → 播客能上传、播放、互动
4. **RN App**(若发布):TestFlight / 蒲公英包内完整跑通核心流程
5. **通知中心**:审核通过播客后作者能在通知中心看到 `PODCAST_APPROVED` 消息
6. **AI 文稿(语音转文字)**:进入已上线播客的播放页 → 点击"文稿"按钮 → 触发 ASR 转写 → 等待 `processing` → `ready` 后查看带时间戳的文稿段落 → 随播放自动滚动高亮 → 弹窗查看完整文稿并一键复制

***

## 12. 引用

- [Prisma 部署指南](https://www.prisma.io/docs/orm/prisma-client/deployment)
- [Taro 4 文档](https://docs.taro.zone/docs/)
- [微信小程序运营规范](https://developers.weixin.qq.com/miniprogram/product/)
- [Let's Encrypt 申请](https://letsencrypt.org/)
- [Expo EAS Build](https://docs.expo.dev/build/introduction/)
- [阿里云百炼 DashScope ASR 文档](https://help.aliyun.com/zh/model-studio/developer-reference/paraformer-batch-file-transcription-api)
- [获取百炼 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)

