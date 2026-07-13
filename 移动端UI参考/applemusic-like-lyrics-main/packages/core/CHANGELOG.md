## 0.5.2 (2026-07-09)

### Patch Changes

- **refactor(core):** 将点击相关事件和样式由歌词行上移至歌词组 ([#538](https://github.com/amll-dev/applemusic-like-lyrics/pull/538))
- **chore(core):** 一些简单的代码优化避免样式重新计算 ([#540](https://github.com/amll-dev/applemusic-like-lyrics/pull/540))
- **chore(core):** 简单优化一点Mesh着色器的代码 ([#558](https://github.com/amll-dev/applemusic-like-lyrics/pull/558))
- **chore:** 修复 linter 警告 ([#539](https://github.com/amll-dev/applemusic-like-lyrics/pull/539))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho
- SteveXMH [@Steve-xmh](https://github.com/Steve-xmh)

## 0.5.1 (2026-05-17)

### Patch Changes

- **fix:** 修复含对唱时歌词错误提前导致的多行高亮 ([#521](https://github.com/amll-dev/applemusic-like-lyrics/pull/521))
- **refactor:** 引入歌词组来包装主歌词和背景人声 & 前置背景人声 ([#531](https://github.com/amll-dev/applemusic-like-lyrics/pull/531))
- **chore:** 更正 package.json 协议声明 ([#534](https://github.com/amll-dev/applemusic-like-lyrics/pull/534))

  仓库根目录的 LICENSE 文件为 AGPL v3.0 协议，但是 package.json 中的 `license` 字段为 `GPL-3.0`。经与原开发者确认，package.json 中的 `license` 字段有误。仓库与其所有产出的 npm 包均应为 AGPL v3 only 协议，SPDX: `AGPL-3.0-only`。因此，更正各包 `package.json` 的 `license` 字段为 `AGPL-3.0-only`。
- **chore(core):** 优化类型定义 ([#519](https://github.com/amll-dev/applemusic-like-lyrics/pull/519))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)

## 0.5.0 (2026-05-12)

### Minor Changes

- **refactor:** 整理核心播放器代码结构，将抽象接口部分集中到统一目录 ([#508](https://github.com/amll-dev/applemusic-like-lyrics/pull/508))
- **refactor:** 整理核心播放器抽象类中时间线、滚动与单行布局部分的结构与状态管理 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))

### Patch Changes

- **fix:** 修复 setCurrentTime 在提供 isSeek 标志时，实际排版未遵守标志导致布局异常漂移的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))
- **fix:** 修复在同一行时间内拖拽进度条时逐字动画不同步的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))
- **fix:** 修复暂停状态下点击行跳转时仍播放逐字动画的问题 ([#509](https://github.com/amll-dev/applemusic-like-lyrics/pull/509))

### Contributors

- Linho [@Linho1219](https://github.com/Linho1219)

## 0.4.2 (2026-05-01)

### Patch Changes

- **feat(core):** 平衡行长度时优先在标点处换行 ([#503](https://github.com/amll-dev/applemusic-like-lyrics/pull/503))
- **fix:** 修复背景行注音高度错误 ([#497](https://github.com/amll-dev/applemusic-like-lyrics/pull/497))
- **fix(core):** 修正平衡行长度时的行宽度计算 ([#502](https://github.com/amll-dev/applemusic-like-lyrics/pull/502))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)

## 0.4.1 (2026-04-23)

### Patch Changes

- **fix:** 在各绑定中暴露歌词优化选项 ([#492](https://github.com/amll-dev/applemusic-like-lyrics/pull/492))
- **fix(vue):** 修复掩码模式错误的类型 ([#496](https://github.com/amll-dev/applemusic-like-lyrics/pull/496))
- **refactor(core):** 重构平均行长度实现 ([#494](https://github.com/amll-dev/applemusic-like-lyrics/pull/494))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)

## 0.4.0 (2026-04-14)

### Minor Changes

- **chore:** 移除 canvas 歌词渲染器 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))

### Patch Changes

- **refactor:** 重构核心库测试组织模式 ([3db83c93](https://github.com/amll-dev/applemusic-like-lyrics/commit/3db83c93))
- **docs:** 修正 optimize-lyric.ts 和 OptimizeLyricOptions 里 cleanUnintentionalOverlaps 的文档和注释 ([75a8c0bb](https://github.com/amll-dev/applemusic-like-lyrics/commit/75a8c0bb))
- **chore:** 更换工具链 ([#476](https://github.com/amll-dev/applemusic-like-lyrics/pull/476))
- **chore:** 在项目范围内启用 isolatedDeclarations ([#480](https://github.com/amll-dev/applemusic-like-lyrics/pull/480))

### Contributors

- apoint123 [@apoint123](https://github.com/apoint123)
- Linho [@Linho1219](https://github.com/Linho1219)
- MoYingJi [@MoYingJi](https://github.com/MoYingJi)
