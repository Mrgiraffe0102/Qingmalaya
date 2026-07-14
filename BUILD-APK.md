# 万卷回响 Android APK 打包指南

> 适用技术栈:Taro 4.2 + React Native 0.73 + Expo SDK 50 + JDK 17 + Gradle 8.3

本指南从零开始,把 `apps/mobile/`(Taro RN 工程)打包成可分发的 `app-release.apk`,并对接已有的"管理后台 → APP 更新"发布流程([app-release 模块](file:///Users/pangyuze/Desktop/Qingmalaya/apps/server/src/app-release))。

---

## 目录

- [0. 流程总览](#0-流程总览)
- [1. 前置检查](#1-前置检查)
- [2. 服务器环境准备](#2-服务器环境准备)
- [3. 生成 Android 原生工程](#3-生成-android-原生工程)
- [4. 改造 Android 工程](#4-改造-android-工程)
- [5. Taro Bundle 集成](#5-taro-bundle-集成)
- [6. 签名配置](#6-签名配置)
- [7. 首次构建 APK](#7-首次构建-apk)
- [8. 后续发版流程](#8-后续发版流程)
- [9. 上传到管理后台](#9-上传到管理后台)
- [10. 常见问题](#10-常见问题)
- [附录 A:关键文件完整内容](#附录-a关键文件完整内容)

---

## 0. 流程总览

```
┌──────────────────┐    pnpm build:rn    ┌──────────────────────────┐
│  Taro RN 源码    │ ──────────────────► │ apps/mobile/dist/        │
│  (apps/mobile/)  │                     │   ├─ index.bundle        │
└──────────────────┘                     │   └─ assets/             │
                                         └──────────┬───────────────┘
                                                    │ 拷贝
                                                    ▼
┌──────────────────┐    ./gradlew         ┌──────────────────────────┐
│ Android 原生工程 │ ──────────────────► │ app-release.apk          │
│  (android/)      │   assembleRelease    │  (约 50-80 MB)          │
└──────────────────┘                     └──────────┬───────────────┘
                                                   │ 上传
                                                   ▼
                                         ┌──────────────────────────┐
                                         │ 管理后台 → APP更新        │
                                         │ (AppRelease 表)          │
                                         └──────────────────────────┘
                                                   │ 拉取
                                                   ▼
                                         ┌──────────────────────────┐
                                         │ 移动端登录后自动检测更新   │
                                         │ (version-check.ts)        │
                                         └──────────────────────────┘
```

> 整套链路一气呵成,核心要点:**Taro 的 JS bundle 必须以 `index.android.bundle` 为文件名放进 `android/app/src/main/assets/`,然后由 RN 的 `DefaultReactNativeHost` 自动加载。**

---

## 1. 前置检查

### 1.1 磁盘空间

| 组件 | 占用 |
|------|------|
| JDK 17 | ~500 MB |
| Android SDK(platforms;android-34 + build-tools;34.0.0) | ~1 GB |
| NDK 25.1.8937393 | ~1.5 GB |
| CMake 3.22.1 | ~200 MB |
| Gradle 缓存 | ~1 GB |
| 项目 `node_modules` | ~1 GB |
| Gradle 首次构建中间产物 | ~1 GB |
| **合计** | **~6 GB** |

```bash
df -h /
free -h
```

- **可用 ≥ 6 GB** → 继续在服务器上做
- **不够** → 改在**本地 macOS** 打包(推荐,Android tooling 在 macOS 上更稳定),打完 APK 再 scp 到服务器走管理后台分发
- **都不行** → 扩磁盘或升级 ECS 配置

### 1.2 当前包名 / 应用名

| 项 | 取值 |
|----|------|
| `applicationId`(包名,反域名) | `com.qingmalaya.app` |
| 应用显示名 | `万卷回响` |
| Taro 版本号(从 [env.ts](file:///Users/pangyuze/Desktop/Qingmalaya/apps/mobile/src/config/env.ts) 读) | 当前 `1.1.0` / code `1` |

> 包名一旦定下,后续发版**不能改**——改了用户就装不上更新(签名不冲突但 applicationId 不同,Android 视为不同应用,数据全丢)。改的话只能让用户卸载重装。

---

## 2. 服务器环境准备

### 2.1 安装 JDK 17

```bash
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk unzip wget
java -version
# 应输出 openjdk version "17.x"
```

### 2.2 安装 Android 命令行工具

```bash
# 创建 SDK 根目录
export ANDROID_HOME=$HOME/android-sdk
mkdir -p "$ANDROID_HOME/cmdline-tools"
cd "$ANDROID_HOME/cmdline-tools"

# 下载(用国内镜像,Google 官方源在国内慢)
wget -O tools.zip https://mirrors.aliyun.com/android/repository/commandlinetools-linux-11076708_latest.zip
# 备选(Google 官方):
# wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

unzip tools.zip
# sdkmanager 要求目录名必须是 "latest"
mv cmdline-tools latest
rm tools.zip
```

### 2.3 安装 SDK 组件

```bash
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# 接受所有 license(必须,否则后续 build 报错)
yes | sdkmanager --licenses

# 安装 RN 0.73 必需的组件
sdkmanager "platform-tools" \
           "platforms;android-34" \
           "build-tools;34.0.0" \
           "ndk;25.1.8937393" \
           "cmake;3.22.1"
```

### 2.4 环境变量持久化

把以下追加到 `~/.bashrc`(或 `~/.zshrc`):

```bash
cat >> ~/.bashrc <<'EOF'

# Android / Java
export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/34.0.0
EOF
source ~/.bashrc
```

### 2.5 验证

```bash
java -version
echo "ANDROID_HOME=$ANDROID_HOME"
ls $ANDROID_HOME
ls $ANDROID_HOME/ndk/         # 应有 25.1.8937393
ls $ANDROID_HOME/build-tools/ # 应有 34.0.0
which adb
```

---

## 3. 生成 Android 原生工程

RN 0.73 的 Android 工程由 `@react-native-community/cli` 模板生成,我们用它作为底座,再针对 Taro 做改造。

### 3.1 在临时目录生成干净模板

```bash
# 退出 apps/mobile,在仓库根目录的同级临时位置生成
cd /opt/wanjvanhuixiang
mkdir -p /tmp/rn-template
cd /tmp/rn-template

# 用 RN 0.73.11(和 apps/mobile 的 react-native 版本一致)
npx --yes @react-native-community/cli@13.6.9 init TaroApp --version 0.73.11 --skip-install --skip-git-init
```

参数说明:
- `--skip-install` 模板不跑 npm install(只生成 android/ 文件夹)
- `--skip-git-init` 模板不初始化 git

### 3.2 拷贝到 apps/mobile/

```bash
cd /opt/wanjvanhuixiang
# 只搬 android/ 目录,不要 iOS、不要 node_modules、不要 package.json
cp -r /tmp/rn-template/TaroApp/android apps/mobile/

# 顺手清掉临时目录
rm -rf /tmp/rn-template

ls apps/mobile/android/
# 应看到: app/ build.gradle gradle/ gradlew gradlew.bat settings.gradle
```

> **不要**把 `TaroApp/package.json` 拷过来——Taro 的 package.json 才是唯一真理。`android/` 是相对独立的工程,只引用 `../node_modules` 找 React Native。

### 3.3 第一次提交(把 android/ 加入版本控制)

```bash
cd /opt/wanjvanhuixiang
git add apps/mobile/android/
git add apps/mobile/.gitignore  # 需要确保 android/build 等被忽略
git commit -m "chore(mobile): scaffold android 工程 for APK 打包"
```

> 之后所有人都能 `git pull` 后直接 `./gradlew assembleRelease`,不必再生成一次。

---

## 4. 改造 Android 工程

模板生成后要做 5 处改造,以适配 Taro + 万卷回响。

### 4.1 改包名(`com.qingmalaya.app`)

```bash
cd /opt/wanjvanhuixiang/apps/mobile/android/app/src/main/java

# 模板默认是 com.taroapp,改成 com.qingmalaya.app
mv com/taroapp com/qingmalaya 2>/dev/null || true
mkdir -p com/qingmalaya/app
mv com/taroapp/* com/qingmalaya/app/ 2>/dev/null || true
rm -rf com/taroapp

# 修正 .kt 文件的 package 声明
sed -i 's|^package com\.taroapp|package com.qingmalaya.app|g' com/qingmalaya/app/*.kt
```

### 4.2 修改 `android/app/build.gradle`

打开 `apps/mobile/android/app/build.gradle`,改以下几处(完整模板见 [附录 A.3](#a3-androidappbuildgradle)):

```gradle
android {
    namespace "com.qingmalaya.app"
    defaultConfig {
        applicationId "com.qingmalaya.app"
        minSdkVersion 23           // RN 0.73 最低要求
        targetSdkVersion 34
        versionCode 1              // 与 env.ts 的 APP_VERSION_CODE 同步
        versionName "1.1.0"        // 与 env.ts 的 APP_VERSION 同步
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
    signingConfigs {
        release {
            // 见第 6 节
            storeFile file('../release.keystore')
            storePassword 'qingmalaya123'
            keyAlias 'qingmalaya'
            keyPassword 'qingmalaya123'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
    packagingOptions {
        // RN 0.73 在多 ABI 打包时可能重复
        pickFirst "**/libc++_shared.so"
        pickFirst "**/libfbjni.so"
        pickFirst "**/libjsc.so"
        pickFirst "**/libhermes.so"
    }
}
```

### 4.3 修改 `android/app/src/main/AndroidManifest.xml`

把模板里的 `.MainActivity` / `.MainApplication` 引用保留即可(已通过包名改造自动匹配),但**改 `android:label`**:

```xml
<application
    android:name=".MainApplication"
    android:label="@string/app_name"
    ...>
```

并在 `android/app/src/main/res/values/strings.xml` 把 `app_name` 改成"万卷回响":

```xml
<resources>
    <string name="app_name">万卷回响</string>
</resources>
```

### 4.4 修改 `android/gradle.properties`

追加/确认:

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.configureondemand=false
android.useAndroidX=true
android.enableJetifier=true
newArchEnabled=false      # Taro 4.2 暂未适配 Fabric,先关
hermesEnabled=true
```

> `newArchEnabled=false` 是关键:Taro 4.2 的 `@tarojs/runtime-rn` 走的是 Bridge 模式,启用 Fabric 会导致启动崩溃。

### 4.5 修改 `android/app/src/main/java/com/qingmalaya/app/MainApplication.kt`

模板里默认的 `MainApplication` 已能用,无需大改。但要确认它**没有**把 `getJSBundleFile()` 写死。完整内容见 [附录 A.5](#a5-mainapplicationkt)。

---

## 5. Taro Bundle 集成

核心:Taro 的 `pnpm build:rn` 产物是 `apps/mobile/dist/index.bundle`,要把它和 assets 拷进 `android/app/src/main/assets/`。

### 5.1 写一个一键打包脚本

在 `apps/mobile/` 下新建 `build-apk.sh`:

```bash
#!/usr/bin/env bash
# build-apk.sh - 万卷回响 Android APK 一键打包
# 用法:
#   ./build-apk.sh           # 默认 release
#   ./build-apk.sh debug     # debug 包(无签名检查)
set -euo pipefail

cd "$(dirname "$0")"

PROFILE="${1:-release}"
echo "==> Build profile: $PROFILE"

# 1) 构建 Taro RN bundle
echo "==> [1/4] pnpm build:rn ..."
pnpm build:rn

# 2) 拷贝 JS bundle 到 android assets
echo "==> [2/4] copy index.bundle to android assets ..."
mkdir -p android/app/src/main/assets
cp dist/index.bundle android/app/src/main/assets/index.android.bundle

# 3) 拷贝静态资源(res/raw、drawable-* 等)
#    Taro 把图片资源输出到 dist/assets/,按 Android 资源目录结构组织
if [ -d dist/assets ]; then
  echo "==> [3/4] copy dist/assets to android res ..."
  cp -rn dist/assets/. android/app/src/main/res/ || true
else
  echo "==> [3/4] no dist/assets, skip"
fi

# 4) Gradle 打包
echo "==> [4/4] ./gradlew assemble$PROFILE ..."
cd android
./gradlew "assemble$PROFILE" --no-daemon

# 5) 输出路径
if [ "$PROFILE" = "release" ]; then
  APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
  APK_PATH="app/build/outputs/apk/$PROFILE/app-$PROFILE.apk"
fi

if [ -f "$APK_PATH" ]; then
  SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "=========================================="
  echo " APK 构建成功"
  echo " 路径: android/$APK_PATH"
  echo " 大小: $SIZE"
  echo "=========================================="
else
  echo "!! APK 未生成,请检查上面的 gradle 输出"
  exit 1
fi
```

```bash
chmod +x apps/mobile/build-apk.sh
```

### 5.2 校验产物结构

```bash
# Taro RN 打包后 dist/ 长这样:
ls apps/mobile/dist/
# index.bundle
# assets/        <-- 静态资源
#   drawable-mdpi/
#   drawable-hdpi/
#   ...

# 拷贝后 android 工程长这样:
ls apps/mobile/android/app/src/main/assets/
# index.android.bundle
```

---

## 6. 签名配置

> **极其重要**:release keystore 一旦生成,后续所有发版必须用**同一个** keystore 签名,否则用户**装不上升级**(Android 通过包名+签名识别应用,签名一变 = 不同应用,只能卸载重装,数据全丢)。**请把 `release.keystore` 备份到至少 2 个安全位置**。

### 6.1 生成 keystore

```bash
cd /opt/wanjvanhuixiang/apps/mobile/android

keytool -genkeypair -v \
  -keystore release.keystore \
  -alias qingmalaya \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass 'qingmalaya123' \
  -keypass 'qingmalaya123' \
  -dname "CN=Qingmalaya, OU=Mobile, O=Qingmalaya, L=Beijing, S=Beijing, C=CN"
```

### 6.2 把 keystore 加入 .gitignore

```bash
cat >> /opt/wanjvanhuixiang/apps/mobile/.gitignore <<'EOF'

# Android release signing key
android/release.keystore
android/app/release.keystore
EOF
```

### 6.3 备份 keystore

```bash
# 备份到本地(命令在本地 macOS 跑)
scp admin@<server>:/opt/wanjvanhuixiang/apps/mobile/android/release.keystore ~/keystore-backup/

# 密码也单独记一下,放在密码管理器里
# alias: qingmalaya
# storePassword: qingmalaya123
# keyPassword: qingmalaya123
```

> 密码我先用占位 `qingmalaya123` 让流程跑通,**生产前务必改成强密码**。

### 6.4 build.gradle 的 signingConfigs 已在 4.2 配好

如果想用 `gradle.properties` 读密码(更安全),参考 [附录 A.3 注释](#a3-androidappbuildgradle)。

---

## 7. 首次构建 APK

```bash
cd /opt/wanjvanhuixiang/apps/mobile

# 1) 装依赖(如果 node_modules 不在)
cd /opt/wanjvanhuixiang
pnpm install

# 2) 跑一键脚本
cd apps/mobile
./build-apk.sh
```

首次构建耗时:**5-15 分钟**(gradle 下载依赖 + 编译 NDK 代码)。

成功后产物:

```
/opt/wanjvanhuixiang/apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 7.1 验证 APK

```bash
# 看 APK 元信息
$ANDROID_HOME/build-tools/34.0.0/aapt dump badging android/app/build/outputs/apk/release/app-release.apk | head -20
# 应输出:
# package: name='com.qingmalaya.app' versionCode='1' versionName='1.1.0'
# application-label:'万卷回响'
# sdkVersion:'23'
# targetSdkVersion:'34'

# 看签名是否正确
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

### 7.2 安装到测试机

```bash
# 插上安卓机或开模拟器
adb devices

adb install -r android/app/build/outputs/apk/release/app-release.apk
# -r 保留数据重装(用于升级测试)
```

---

## 8. 后续发版流程

每次发新版本,只改 2 个数字:

### 8.1 同步版本号

| 位置 | 字段 | 当前值 | 说明 |
|------|------|--------|------|
| [env.ts](file:///Users/pangyuze/Desktop/Qingmalaya/apps/mobile/src/config/env.ts#L41-L42) | `APP_VERSION` | `1.1.0` | 用户可见的版本号 |
| [env.ts](file:///Users/pangyuze/Desktop/Qingmalaya/apps/mobile/src/config/env.ts#L41-L42) | `APP_VERSION_CODE` | `1` | 内部递增整数,必须**严格大于上一个** |
| `android/app/build.gradle` | `versionCode` | `1` | 同上 |
| `android/app/build.gradle` | `versionName` | `"1.1.0"` | 同上 |

> 规则:`APP_VERSION_CODE` 每次发版 +1,`APP_VERSION` 按 semver 递增。

### 8.2 重新打包

```bash
# 提交代码 → 服务器 pull → 重新跑
cd /opt/wanjvanhuixiang
git pull
cd apps/mobile
./build-apk.sh
```

产物仍是 `android/app/build/outputs/apk/release/app-release.apk`,覆盖即可。

---

## 9. 上传到管理后台

打包出 APK 后,登录管理后台的"APP更新"页上传。

### 9.1 操作步骤

1. 浏览器打开 `https://<你的域名>/admin/`,用 SUPER_ADMIN 账号登录
2. 左侧菜单 → **APP更新** → 右上角 **新建版本**
3. 填写:
   - **版本号**:`1.1.0`(与 APK 内的 versionName 一致)
   - **版本代码**:`1`(与 APK 内的 versionCode 一致,必须**严格大于**库内历史最大值)
   - **更新内容**:`修复xxx / 新增xxx`(富文本,移动端会显示在更新弹窗)
4. **上传 APK**:选择刚打出的 `app-release.apk`(< 500 MB,后端会校验 MIME)
5. 点 **保存**

后端把这个 release 写进 `AppRelease` 表,`GET /releases/latest` 立即可拉到。

### 9.2 用户端体验

移动端用户行为(见 [version-check.ts](file:///Users/pangyuze/Desktop/Qingmalaya/apps/mobile/src/utils/version-check.ts)):

| 场景 | 触发 | 行为 |
|------|------|------|
| 登录后检测 | `checkUpdateOnLogin` | 若 `latest.versionCode > APP_VERSION_CODE`,弹"发现新版本"窗,点"立即更新"→ `Taro.downloadFile` + `Taro.openDocument` 触发系统安装 |
| 我的页面手动检查 | `manualCheckUpdate` | 同上流程 |
| H5 更新后首次打开 | `checkUpdateOnWebOpen` | 弹"已更新到 v1.1.0"信息窗 |

---

## 10. 常见问题

### 10.1 磁盘不够

`df -h /` 看 `/` 占用。如果 `/opt` 是单独挂载点,看那个。

解决:
- 扩云盘
- 加数据盘挂到 `/opt`
- 改在本地 macOS 打包(推荐)

### 10.2 `NDK not configured`

```
NDK at /home/admin/android-sdk/ndk/25.1.8937393 did not have a source.properties file
```

解决:删掉重装,确认 `sdkmanager` 输出里 NDK 25.1.8937393 是 INSTALLED 状态。

```bash
sdkmanager --list_installed | grep ndk
# 应输出: ndk;25.1.8937393
```

### 10.3 Gradle 构建 OOM

```
Java heap space
```

解决:在 `android/gradle.properties` 把 `Xmx` 调到 4096 或更高。2GB 机器上调到 4096 仍可能 OOM,这时必须加 swap:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
```

### 10.4 编译期找不到 `metro-runtime`

见上次的修复:[.npmrc](file:///Users/pangyuze/Desktop/Qingmalaya/.npmrc) 加 `public-hoist-pattern`,以及 [metro.config.js](file:///Users/pangyuze/Desktop/Qingmalaya/apps/mobile/metro.config.js) 改 `nodeModulesPaths`。

### 10.5 安装时 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

用户机里装过旧版 APK(签名不同)。让用户**先卸载再装**。**这是为什么 keystore 必须备份**。

### 10.6 安装时 `INSTALL_FAILED_OLDER_SDK`

APK 的 minSdk 高于用户安卓版本。当前 minSdkVersion = 23(Android 6.0),应该不影响大部分用户。

### 10.7 `versionCode` 没递增导致后端不返回新版本

`/releases/latest` 默认返回 `versionCode` 最大的那条。如果新建 release 时填的 code ≤ 已存在的最大 code,会被当成历史版本存,但不会成为 "latest"。**确保新建的 versionCode 严格大于历史最大值**。

### 10.8 Taro bundle 没更新

跑 `./build-apk.sh` 时如果只改了 JS 没重跑 `pnpm build:rn`,会拿到旧 bundle。脚本第一步就是 `pnpm build:rn`,请确认没注释掉。

### 10.9 启动后白屏 / 闪退

最常见原因:Taro 编译产物的 JS bundle 没塞到 `assets/index.android.bundle`。

```bash
# 验证 APK 里有这个文件
unzip -l android/app/build/outputs/apk/release/app-release.apk | grep index.android.bundle
# 应有: assets/index.android.bundle
```

如果缺失,检查 `build-apk.sh` 的 `cp dist/index.bundle ...` 那一步是否成功。

### 10.10 网络请求 404 / API 地址错

Taro `__API_BASE_URL__` 在 `pnpm build:rn` 时通过 `defineConstants` 注入。如果服务器域名变了,要重新 build,不能只重打 APK。

---

## 附录 A:关键文件完整内容

### A.1 `android/settings.gradle`

```gradle
rootProject.name = 'qingmalaya'
apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle"); applyNativeModulesSettingsGradle(settings)
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
```

### A.2 `android/build.gradle`

```gradle
buildscript {
    ext {
        buildToolsVersion = "34.0.0"
        minSdkVersion = 23
        compileSdkVersion = 34
        targetSdkVersion = 34
        ndkVersion = "25.1.8937393"
        kotlinVersion = "1.8.0"
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.1.1")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
    }
}

apply plugin: "com.facebook.react.rootproject"
```

### A.3 `android/app/build.gradle`

```gradle
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

react {
    // Taro 编译产物位置,scripts 会确保 assets 里有 index.android.bundle
    // 但要让 RN 知道 entry 是哪个,这里指 index.js
    entryFile = file("../../index.js")
    bundleAssetName = "index.android.bundle"
    bundleInDebug = false
    bundleInRelease = true
}

def enableProguardInReleaseBuilds = true
def jscFlavor = 'org.webkit:android-jsc:+'

android {
    namespace "com.qingmalaya.app"
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "com.qingmalaya.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1                 // 与 env.ts 的 APP_VERSION_CODE 同步
        versionName "1.1.0"           // 与 env.ts 的 APP_VERSION 同步
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }

    signingConfigs {
        debug {
            // 用 Android 默认 debug keystore
        }
        release {
            storeFile file('../release.keystore')
            storePassword 'qingmalaya123'
            keyAlias 'qingmalaya'
            keyPassword 'qingmalaya123'
            // 生产环境推荐用 gradle.properties 注入密码:
            // storePassword project.env.MYAPP_RELEASE_STORE_PASSWORD
            // keyPassword project.env.MYAPP_RELEASE_KEY_PASSWORD
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            shrinkResources enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }

    packagingOptions {
        pickFirst "**/libc++_shared.so"
        pickFirst "**/libfbjni.so"
        pickFirst "**/libjsc.so"
        pickFirst "**/libhermes.so"
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")
    if (hermesEnabled.toBoolean()) {
        implementation("com.facebook.react:hermes-android")
    } else {
        implementation jscFlavor
    }
}
```

### A.4 `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true"
        android:supportsRtl="true">

        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

> `usesCleartextTraffic="true"` 仅在调试期方便访问 http API,生产建议改 false + 全站 HTTPS。

### A.5 `MainApplication.kt`

路径:`android/app/src/main/java/com/qingmalaya/app/MainApplication.kt`

```kotlin
package com.qingmalaya.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages

            // Taro 的 RN 入口是 index.js(由 @tarojs/rn-supporter/entry-file.js 引导)
            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
```

### A.6 `MainActivity.kt`

路径:`android/app/src/main/java/com/qingmalaya/app/MainActivity.kt`

```kotlin
package com.qingmalaya.app

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Taro 不会真用这个 component name 做桥接(RN 走 JS 层的 AppRegistry.registerComponent),
     * 但 RN 模板要求返回非空字符串,这里写死一个占位即可。
     */
    override fun getMainComponentName(): String = "TaroApp"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)  // 传 null 防止 RN 状态恢复时白屏
    }
}
```

> 注意 `super.onCreate(null)` 而不是 `savedInstanceState`,这是 RN 0.73 模板的官方推荐做法。

### A.7 `proguard-rules.pro`

路径:`android/app/proguard-rules.pro`

```proguard
# React Native ProGuard 规则
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  void set*(***);
  *** get*();
}

-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { native <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# Taro / Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
```

### A.8 `gradle.properties`

路径:`android/gradle.properties`

```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
org.gradle.parallel=true
org.gradle.configureondemand=false
org.gradle.daemon=false

# Android
android.useAndroidX=true
android.enableJetifier=true
android.suppressUnsupportedCompileSdk=34

# React Native
newArchEnabled=false
hermesEnabled=true
```

### A.9 `android/app/src/main/res/values/strings.xml`

```xml
<resources>
    <string name="app_name">万卷回响</string>
</resources>
```

### A.10 `android/app/src/main/res/values/styles.xml`

```xml
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">@android:color/white</item>
        <item name="android:statusBarColor">#fbf9f8</item>
        <item name="android:windowLightStatusBar">true</item>
    </style>
</resources>
```

---

## 附录 B:关键命令速查

| 任务 | 命令 |
|------|------|
| 装依赖 | `cd /opt/wanjvanhuixiang && pnpm install` |
| 仅打 JS bundle | `cd apps/mobile && pnpm build:rn` |
| 一键打 APK | `cd apps/mobile && ./build-apk.sh` |
| 验证 APK 信息 | `$ANDROID_HOME/build-tools/34.0.0/aapt dump badging app/build/outputs/apk/release/app-release.apk` |
| 验证签名 | `$ANDROID_HOME/build-tools/34.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk` |
| 安装到测试机 | `adb install -r app/build/outputs/apk/release/app-release.apk` |
| 清空 gradle 缓存 | `cd android && ./gradlew clean` |

---

## 附录 C:版本号同步清单(每次发版必改)

```
1. apps/mobile/src/config/env.ts
   APP_VERSION      = 'X.Y.Z'        ← 用户可见版本
   APP_VERSION_CODE = N              ← 严格递增整数

2. apps/mobile/android/app/build.gradle
   versionCode N                     ← 必须 = env.ts 的 APP_VERSION_CODE
   versionName "X.Y.Z"               ← 必须 = env.ts 的 APP_VERSION

3. 管理后台 → APP更新 → 新建版本
   版本号:    X.Y.Z                  ← 同上
   版本代码:  N                      ← 同上,且 > 历史最大值
   更新内容:  (富文本)
   上传 APK:  app-release.apk
```

---

**完成。** 至此 `apps/mobile/build-apk.sh` + `android/` 仓库内已具备完整 Android APK 打包能力,后续发版只改版本号即可。
