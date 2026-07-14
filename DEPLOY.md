# 万卷回响 — 部署指南

本文档详细介绍如何将「万卷回响」校园播客平台部署到生产环境。项目采用 pnpm monorepo + Docker Compose 架构，一条命令即可拉起全部服务。

---

## 目录

- [项目架构](#项目架构)
- [环境要求](#环境要求)
- [一、首次部署（从零开始）](#一首次部署从零开始)
- [二、配置说明](#二配置说明)
- [三、日常运维](#三日常运维)
- [四、更新部署](#四更新部署)
- [五、Nginx 反向代理与 HTTPS](#五nginx-反向代理与-https)
- [六、常见问题排查](#六常见问题排查)

---

## 项目架构

```
                    ┌─────────────────────────────────────────┐
                    │              服务器 (宿主机)               │
                    │                                         │
  用户 ──HTTPS──►  Nginx 反代  ──►  Docker Compose            │
                    │                   ├─ mobile  (nginx:80)  │
                    │                   ├─ admin   (nginx:80)  │
                    │                   ├─ server  (NestJS:3000)│
                    │                   └─ mysql   (MySQL:3306)│
                    └─────────────────────────────────────────┘
```

四个容器：

| 服务 | 容器名 | 构建产物 | 宿主机端口 | 容器端口 |
|------|--------|----------|-----------|---------|
| MySQL 8.0 | qingmalaya-mysql | `mysql:8.0` | 3306 | 3306 |
| NestJS 后端 | qingmalaya-server | `apps/server/Dockerfile` | 3000 | 3000 |
| 管理后台 | qingmalaya-admin | `apps/admin/Dockerfile` | 5174 | 80 |
| 移动端 H5 | qingmalaya-mobile | `apps/mobile/Dockerfile` | 10086 | 80 |

> 生产环境中，建议仅暴露 80/443 端口（通过宿主机 Nginx 反代），不直接暴露 3000/5174/10086。

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Docker | 24+ | `docker --version` 检查 |
| Docker Compose | v2+ | `docker compose version` 检查 |
| 服务器内存 | 2GB+ | 镜像构建时内存消耗较大（bcrypt 编译等），建议 4GB+ |
| 磁盘空间 | 10GB+ | 镜像 + MySQL 数据 + 上传文件 |

> 如果服务器内存不足（如 2GB ECS），构建时可能出现 `EOF` 错误。解决方法见 [常见问题](#六常见问题排查)。

---

## 一、首次部署（从零开始）

### 1.1 克隆代码到服务器

```bash
git clone <仓库地址> /opt/qingmalaya
cd /opt/qingmalaya
```

### 1.2 修改生产环境配置

编辑 `docker-compose.yml`，修改以下关键项：

```yaml
services:
  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: <改为强密码>      # ← 必改
      MYSQL_PASSWORD: <改为强密码>           # ← 必改

  server:
    environment:
      # 数据库连接串中的密码需与上面 MYSQL_PASSWORD 一致
      DATABASE_URL: 'mysql://qingmalaya:<新密码>@mysql:3306/qingmalaya'
      JWT_SECRET: <改为随机长字符串>          # ← 必改，至少 32 位
      DASHSCOPE_API_KEY: <阿里云百炼 API 密钥> # ← AI 文稿识别功能需要
      PUBLIC_BASE_URL: https://api.你的域名.cn  # ← 改为你的实际域名

  mobile:
    build:
      args:
        API_BASE_URL: https://api.你的域名.cn/api   # ← 改为你的实际 API 地址
        STATIC_ORIGIN: https://static.你的域名.cn    # ← 改为你的静态资源地址
```

> **安全提醒**：默认的 `JWT_SECRET`、数据库密码均为占位符，上线前**必须**修改。

### 1.3 生成 Prisma 迁移文件

项目目前没有预置迁移文件，需先生成一次：

```bash
# 先单独启动 MySQL
docker compose up -d mysql

# 等待 MySQL 健康检查通过（约 10-15 秒）
docker compose ps  # 确认 mysql 状态为 healthy

# 用容器内的 Prisma 生成初始迁移
docker compose run --rm server npx prisma migrate dev --name init
```

### 1.4 构建并启动全部服务

```bash
docker compose up -d --build
```

首次构建需要下载依赖、编译 bcrypt/Prisma，通常需要 5-15 分钟（取决于网络和服务器性能）。所有 Dockerfile 已配置阿里云镜像源加速，国内服务器也能正常构建。

### 1.5 初始化数据库种子数据

容器启动后，执行种子脚本创建初始管理员账号、标签、示例数据：

```bash
docker compose exec server npx prisma db seed
```

> 种子脚本是幂等的，可安全重复执行。

### 1.6 验证部署

```bash
# 检查所有容器运行状态
docker compose ps

# 查看服务器日志
docker compose logs -f server

# 测试 API 是否响应
curl http://localhost:3000/api
```

浏览器访问：

| 服务 | 地址 |
|------|------|
| 管理后台 | http://服务器IP:5174 |
| 移动端 H5 | http://服务器IP:10086 |
| API 接口 | http://服务器IP:3000/api |

默认管理员账号（种子数据创建，请及时修改密码）：

| 角色 | 学号 | 密码 |
|------|------|------|
| 超级管理员 | `admin` | `admin123` |
| 运营 | `operator` | `operator123` |

---

## 二、配置说明

### 2.1 服务端环境变量

在 `docker-compose.yml` 的 `server` 服务 `environment` 中配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `mysql://qingmalaya:qingmalaya123@mysql:3306/qingmalaya` | MySQL 连接串 |
| `JWT_SECRET` | `change-me-in-production-please` | JWT 签名密钥，**必须修改** |
| `JWT_ACCESS_TTL` | `2h` | Access Token 有效期 |
| `JWT_REFRESH_TTL` | `7d` | Refresh Token 有效期 |
| `UPLOAD_DIR` | `/app/uploads` | 上传文件存储目录 |
| `MAX_COVER_SIZE` | `5242880` (5MB) | 封面图最大字节数 |
| `MAX_AUDIO_SIZE` | `209715200` (200MB) | 音频文件最大字节数 |
| `MAX_AUDIO_DURATION` | `3600` (60分钟) | 音频最大时长（秒） |
| `DASHSCOPE_API_KEY` | 空 | 阿里云百炼 API 密钥（AI 文稿识别） |
| `DASHSCOPE_BASE_URL` | 阿里云默认地址 | 百炼 API 端点 |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | 服务端公开访问地址 |

### 2.2 移动端构建参数

在 `docker-compose.yml` 的 `mobile` 服务 `build.args` 中配置：

| 参数 | 说明 |
|------|------|
| `API_BASE_URL` | 移动端请求的 API 地址，如 `https://api.example.com/api` |
| `STATIC_ORIGIN` | 静态资源（封面/音频）地址，如 `https://static.example.com` |

> 这两个参数在构建时注入到 H5 包中。修改后需重新构建 mobile 镜像：
> ```bash
> docker compose build mobile && docker compose up -d mobile
> ```

### 2.3 MySQL 初始化

`docker/mysql/init/01-grants.sql` 会在 MySQL 首次启动时自动执行，为 `qingmalaya` 用户授予完整权限（Prisma 需要）。该脚本仅在数据卷为空时运行一次。

### 2.4 上传文件持久化

上传的播客封面和音频文件存储在容器内 `/app/uploads` 目录，通过 bind mount 映射到宿主机 `./uploads/`：

```yaml
volumes:
  - ./uploads:/app/uploads
```

文件删除容器后依然保留。如需备份，直接打包 `./uploads/` 目录即可。

---

## 三、日常运维

### 3.1 常用命令

```bash
# 查看容器状态
docker compose ps

# 查看某个服务的实时日志
docker compose logs -f server    # 后端日志
docker compose logs -f admin     # 管理后台日志
docker compose logs -f mobile    # 移动端日志

# 查看最近 100 行日志
docker compose logs --tail 100 server

# 进入容器执行命令
docker compose exec server sh
docker compose exec mysql mysql -u qingmalaya -p

# 重启某个服务
docker compose restart server

# 停止全部服务（保留数据）
docker compose down

# 停止并删除数据卷（⚠️ 清空所有数据）
docker compose down -v
```

### 3.2 数据库备份与恢复

```bash
# 备份
docker compose exec mysql mysqldump -u qingmalaya -p qingmalaya > backup_$(date +%Y%m%d).sql

# 恢复
docker compose exec -T mysql mysql -u qingmalaya -p qingmalaya < backup_20260101.sql
```

建议设置定时任务自动备份：

```bash
# crontab -e
0 3 * * * cd /opt/qingmalaya && docker compose exec -T mysql mysqldump -u qingmalaya -p密码 qingmalaya > /backup/qingmalaya_$(date +\%Y\%m\%d).sql
```

### 3.3 上传文件备份

```bash
# 打包上传目录
tar -czf uploads_$(date +%Y%m%d).tar.gz uploads/
```

### 3.4 Prisma Studio（可视化数据库管理）

```bash
docker compose exec server npx prisma studio
```

> Prisma Studio 默认监听 5555 端口，需在 `docker-compose.yml` 中映射端口后才能从外部访问。或通过 SSH 隧道访问：
> ```bash
> ssh -L 5555:localhost:5555 user@你的服务器
> ```

---

## 四、更新部署

### 4.1 拉取最新代码

```bash
cd /opt/qingmalaya
git pull origin main
```

### 4.2 重新构建并启动

```bash
# 如果有 Dockerfile 或依赖变更，需要 --build
docker compose up -d --build

# 如果只有代码变更（不影响 Docker 镜像），可以只重启
docker compose restart server
```

### 4.3 数据库迁移

服务器容器启动时会自动执行 `prisma migrate deploy`，应用所有待执行的迁移文件。

如果本地开发时新增了迁移（`prisma migrate dev`），提交迁移文件后，下次部署会自动应用。

手动执行迁移：

```bash
docker compose exec server npx prisma migrate deploy
```

### 4.4 只更新某个服务

```bash
# 只重新构建和启动移动端
docker compose build mobile && docker compose up -d mobile

# 只重新构建和启动后端
docker compose build server && docker compose up -d server
```

---

## 五、Nginx 反向代理与 HTTPS

生产环境建议在宿主机上安装 Nginx 作为统一入口，将不同域名/路径转发到各容器，并配置 HTTPS。

### 5.1 安装 Nginx 和 Certbot

```bash
# Ubuntu/Debian
apt update && apt install -y nginx certbot python3-certbot-nginx
```

### 5.2 Nginx 配置示例

创建 `/etc/nginx/conf.d/qingmalaya.conf`：

```nginx
# 管理后台
server {
    listen 80;
    server_name admin.你的域名.cn;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:5174;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 移动端 H5
server {
    listen 80;
    server_name m.你的域名.cn;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:10086;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API 后端
server {
    listen 80;
    server_name api.你的域名.cn;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

# 静态资源（上传的封面/音频）
server {
    listen 80;
    server_name static.你的域名.cn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 重载 Nginx 并申请 HTTPS 证书

```bash
nginx -t                    # 检查配置语法
systemctl reload nginx      # 重载配置

# 申请 Let's Encrypt 免费证书（会自动修改 Nginx 配置启用 HTTPS）
certbot --nginx -d admin.你的域名.cn -d m.你的域名.cn -d api.你的域名.cn -d static.你的域名.cn
```

### 5.4 更新移动端构建参数

HTTPS 配置完成后，需要更新 `docker-compose.yml` 中 mobile 的构建参数为 HTTPS 地址，然后重新构建：

```bash
# 修改 docker-compose.yml 中的 build.args
docker compose build mobile && docker compose up -d mobile
```

---

## 六、常见问题排查

### 构建时 `EOF` 错误 / 内存不足

服务器内存不足（常见于 2GB ECS）导致 BuildKit 编译失败。

```bash
# 方法一：清理构建缓存
docker builder prune -f

# 方法二：停止其他容器释放内存
docker compose down && docker compose up -d --build

# 方法三：添加 swap 分区
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile

# 方法四：禁用 BuildKit
DOCKER_BUILDKIT=0 docker compose up -d --build
```

### 容器启动后服务器报数据库连接失败

MySQL 容器可能尚未完全就绪。`docker-compose.yml` 已配置 `depends_on: condition: service_healthy`，但如仍出现此问题：

```bash
# 检查 MySQL 容器状态
docker compose ps mysql

# 手动重启服务器容器（等待 MySQL 就绪后）
docker compose restart server
```

### `prisma migrate dev` 权限不足

确保 MySQL 初始化脚本 `docker/mysql/init/01-grants.sql` 已执行（首次启动数据卷为空时自动执行）。如果数据卷已存在但权限缺失：

```bash
docker compose exec mysql mysql -u root -proot密码 -e "GRANT ALL PRIVILEGES ON *.* TO 'qingmalaya'@'%'; FLUSH PRIVILEGES;"
```

### 移动端无法访问 API

检查 `docker-compose.yml` 中 mobile 服务的 `build.args`：

- `API_BASE_URL` 必须是用户浏览器能访问的地址（不能用容器内部地址 `mysql:3306`）
- 如果使用 HTTPS，`API_BASE_URL` 也必须是 `https://` 开头
- 修改后需要重新构建镜像：`docker compose build mobile && docker compose up -d mobile`

### 音频上传失败 / 上传后无法播放

1. 确认服务器容器中已安装 ffmpeg（Dockerfile 中已包含，自定义构建需检查）
2. 检查 `MAX_AUDIO_SIZE` 和 `MAX_AUDIO_DURATION` 配置是否满足需求
3. 检查 Nginx 反代的 `client_max_body_size` 是否足够大（建议 200M）
4. 确认 `uploads` 目录权限正常且磁盘空间充足

### 上传文件丢失

上传文件通过 bind mount 挂载在 `./uploads/`，确认：

```bash
# 检查目录是否存在且有内容
ls -la uploads/

# 检查容器挂载
docker compose exec server ls -la /app/uploads/
```

### 查看实时日志定位问题

```bash
# 所有服务
docker compose logs -f

# 只看后端，过滤错误
docker compose logs -f server | grep -i error
```

---

## 附录：完整首次部署流程速查

```bash
# 1. 克隆代码
git clone <仓库地址> /opt/qingmalaya && cd /opt/qingmalaya

# 2. 修改 docker-compose.yml 中的密码、JWT_SECRET、域名等配置
vim docker-compose.yml

# 3. 先启动 MySQL
docker compose up -d mysql

# 4. 生成初始 Prisma 迁移
docker compose exec server npx prisma migrate dev --name init

# 5. 构建并启动全部服务
docker compose up -d --build

# 6. 初始化种子数据
docker compose exec server npx prisma db seed

# 7. 配置宿主机 Nginx 反代 + HTTPS
# 8. 验证访问
```
