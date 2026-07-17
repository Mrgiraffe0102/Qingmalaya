# Site-wide forced popup (全局弹窗)

**Date:** 2026-07-18
**Status:** Draft (pending user review)
**Owner:** 万卷回响 admin
**Scope:** Backend (NestJS) + Admin (React/Vite) + Mobile (Taro)

## 1. Background

管理员希望能在后台维护一条"非常强的消息提醒"——任何用户打开网站（含未登录的登录页）的第一时间就该看到。已有的 `Announcement` 公告功能是放在"消息中心"列表里的轻量入口，不能强制弹出、也无法在登录页显示，因此需要新增一个独立的功能。

## 2. Goals

- 后台可编辑一条全局强制弹窗（标题 + 纯文本正文）。
- 弹窗在用户打开/刷新网站时第一时间显示，未登录用户也能看到。
- 关闭后本次浏览器会话内不再弹出；刷新或重新打开浏览器会再次显示。
- 后台可随时启用/禁用，不必删除。

## 3. Non-goals

- 多条弹窗排队/优先级——同时只有一条。
- 富文本/图片/视频——纯文本即可。
- 弹窗内可点击跳转——本期不实现。
- 国际化——只展示中文。
- 用户关闭回执上报服务端——本期只在前端 sessionStorage 标记。

## 4. Data model

新增 `Popup` 表（Prisma）：

```prisma
model Popup {
  id        Int      @id @default(autoincrement())
  title     String   @db.VarChar(120)
  content   String   @db.Text
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

设计要点：
- 始终只有一条记录（id=1）。`upsert` 永远以 id=1 为锚。
- `enabled=false` 即"不显示"——不删除，保留历史内容。
- 不加 `version` 字段，因为本期不持久化"已对哪些用户展示过"。

Migration 文件：由 `pnpm --filter server prisma migrate dev --name add_popup_table` 自动生成（文件名带时间戳）。

## 5. Backend

### 5.1 Module: `apps/server/src/popup/`

```
popup/
  popup.module.ts
  popup.controller.ts
  popup.service.ts
  dto/
    popup-update.dto.ts
```

### 5.2 `PopupService`

```ts
class PopupService {
  // 返回当前唯一一条（任意 enabled 状态）；不存在返回 null
  async find(): Promise<Popup | null>;

  // 返回 enabled=true 的那条；不存在返回 null（公开接口用）
  async findActive(): Promise<Popup | null>;

  // upsert 单条：以 id=1 为锚
  async upsert(dto: PopupUpdateDto): Promise<Popup>;
}
```

返回给前端的 contract（共享类型）：

```ts
// 单条全局弹窗——管理员读和公开读共用此 shape
interface SitePopup {
  id: number;
  title: string;
  content: string;
  enabled: boolean;
  updatedAt: ISODateString; // 用于客户端判断"管理员是否刚改了内容"
}

// 管理员 upsert 时的请求体（与服务端 DTO 一致）
interface PopupUpdatePayload {
  title: string;        // <= 120
  content: string;      // <= 4000
  enabled?: boolean;    // 默认 true
}
```

放在 `packages/shared/src/types.ts` 里，read 和 write 共享 `SitePopup` 的字段子集。

### 5.3 Endpoints

公开端点（**无任何 auth 装饰**）：

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/popup/active` | 返回 `enabled=true` 的弹窗；不存在返 `{ popup: null }` |

管理端点（JwtAuthGuard + RolesGuard，OPERATOR / SUPER_ADMIN）：

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/admin/popup` | 读取当前唯一一条 |
| PUT | `/admin/popup` | upsert（创建或整体更新 id=1） |

`/admin/popup` 同时要求 `Roles('SUPER_ADMIN')`——比 OPERATOR 权限更严，原因是"强制弹窗"是面向全站的强提醒，需要超管兜底。

注意：当前 RolesGuard 把 TEACHER 映射成 OPERATOR，SUPER_ADMIN 不变。所以"超管"在控制器层 `@Roles('SUPER_ADMIN')` 下不会被教师/运营角色访问。

### 5.4 DTO 校验

`PopupUpdateDto`：
- `title`: string, max 120, required
- `content`: string, max 4000, required
- `enabled`: boolean, optional, default true

用 class-validator，与现有 DTO 风格保持一致。

### 5.5 Module 挂载

在 `apps/server/src/app.module.ts` 的 imports 里加 `PopupModule`。

## 6. Admin (React + Vite)

### 6.1 页面

新文件：`apps/admin/src/pages/Popup/index.tsx`

结构：
- ProCard 标题"全局弹窗"
- 启用开关（Switch）
- 标题 Input（max 120）
- 正文 Input.TextArea（autoSize 5-10 行）
- "保存" 按钮 → `PUT /admin/popup`
- 进入页面先 `GET /admin/popup` 拉取当前内容（可能为 null，全部为空表单）

### 6.2 API 客户端

新文件：`apps/admin/src/api/popup.ts`

```ts
export const getPopup = () => request<{ popup: SitePopup | null }>('/admin/popup');
export const updatePopup = (payload: PopupUpdatePayload) =>
  request<SitePopup>('/admin/popup', { method: 'PUT', body: payload });
```

### 6.3 路由 / 菜单

- `apps/admin/src/App.tsx` 加路由：`<Route path="popup" element={<PopupPage />} />`
- `apps/admin/src/layouts/AdminLayout.tsx`：
  - `menuRouteMap` 加 `'/popup': 'popup'`
  - `menuData` 在"系统设置"分组下加 `{ path: '/popup', name: '全局弹窗', icon: <NotificationOutlined /> }`
  - `SUPER_ADMIN_ONLY_PATHS` 加 `'/popup'`——保证只有 SUPER_ADMIN 看到菜单
- 菜单图标：`<NotificationOutlined />`（已有 import）

### 6.4 菜单顺序

```
系统设置
  ├ 基础设置
  ├ 全局弹窗   ← 新增，放在"基础设置"之后
  ├ 操作日志
  └ 超级日志
```

## 7. Mobile (Taro H5 / 微信小程序)

### 7.1 新组件

`apps/mobile/src/components/SitePopup/index.tsx`

```tsx
function SitePopup() {
  const [popup, setPopup] = useState<SitePopup | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 调用 /popup/active（无 auth）
        const data = await getActivePopup();
        if (!cancelled) setPopup(data.popup);
      } catch (e) {
        // 静默失败——弹窗是辅助功能，不能阻塞首屏
        if (!cancelled) setPopup(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 三态：未加载完/无/有
  if (popup === undefined || !popup) return null;
  if (sessionStorage.getItem('sitePopup:dismissed') === '1') return null;

  const onClose = () => {
    sessionStorage.setItem('sitePopup:dismissed', '1');
    setPopup((p) => (p ? null : p));
  };

  return (
    <View className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <View className="mx-5 max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl">
        <Text className="mb-3 block text-lg font-bold text-on-surface">{popup.title}</Text>
        <Text className="mb-6 block whitespace-pre-line text-sm text-on-surface-variant leading-relaxed">
          {popup.content}
        </Text>
        <View onClick={onClose} className="flex h-11 items-center justify-center rounded-full bg-primary text-on-primary text-sm font-semibold">
          我知道了
        </View>
      </View>
    </View>
  );
}
```

样式约定：与 DESIGN.md 中"glass + primary 圆角按钮"一致；`z-[9999]` 高于所有 AppLayout 元素（含 TabBar/PlaybackBar）。

### 7.2 API 客户端

`apps/mobile/src/api/popup.ts`

```ts
import { get } from '../utils/request';
import type { SitePopup } from '@qingmalaya/shared';

export async function getActivePopup() {
  // skipAuth: true —— 这是一个公开接口
  return get<{ popup: SitePopup | null }>('/popup/active', { skipAuth: true });
}
```

需要确认 `apps/mobile/src/utils/request.ts` 是否已经支持 `skipAuth` 透传——简单检查后复用现有逻辑（已存在的 `auth.ts`/login 都有 `skipAuth: true` 用法）。

### 7.3 挂载点

`apps/mobile/src/app.tsx`：

```tsx
import SitePopup from './components/SitePopup';

class App extends Component {
  // ... 现有 componentDidMount
  render() {
    return (
      <>
        <GlobalAudioPlayer />
        <SitePopup />     {/* ← 新增，根层级，所有页面都在它下面 */}
        {this.props.children}
      </>
    );
  }
}
```

放在根组件、不放进 AppLayout 的好处：
- 登录页（不走 AppLayout）也能弹
- 详情页（hideChrome=true）也能弹
- 优先级最高，全屏遮罩阻断一切交互

### 7.4 sessionStorage 在小程序里的兼容性

- H5：直接用 `sessionStorage`，符合预期
- 微信小程序：Taro 提供 `Taro.getStorageSync` / `Taro.setStorageSync`，在 RN 端可能没实现 sessionStorage。需要 fallback：
  - 优先 `Taro.getStorageSync('sitePopup:dismissed') === '1'`
  - 如果都没有，就当作"未关闭"——这反而是更安全的行为（每次都弹）
- 实际：用 Taro 提供的 storage API 抹平差异
  - `Taro.getStorageSync('sitePopup:dismissed')` 和 `Taro.setStorageSync(...)`
  - Taro 的 storageSync 在 H5 下底层就是 sessionStorage/localStorage，行为正确

## 8. Edge cases / Failure modes

| 场景 | 行为 |
| --- | --- |
| 后端 500 / 网络错误 | 静默吞掉，弹窗不显示。首屏不阻塞。 |
| 后端返回 `popup: null` | 弹窗不显示（管理员还没创建）。 |
| 用户在登录页 | 弹窗照常显示并能关闭。 |
| 用户登录后跳转到首页 | 关闭状态保留（sessionStorage），不会重新弹。 |
| 管理员改了内容但 `enabled` 没变 | 刷新前不再显示；刷新后显示新内容。 |
| 管理员 `enabled=false` | 接口返回 null，弹窗不显示；旧 sessionStorage 项忽略即可。 |
| `title` 包含 HTML/脚本 | 不渲染，纯文本展示（`{popup.title}` 在 Text 组件中不会被解释）。 |

## 9. Testing

- 手动测试清单（不需要单测，项目目前没装 jest 跑 server 测试）：
  1. 后台未建弹窗 → 访问网站不弹
  2. 后台建弹窗（enabled=true）→ 访问网站弹出
  3. 点"我知道了" → 关闭
  4. SPA 内切页 → 不再弹
  5. F5 刷新 → 再次弹出
  6. 关闭整个浏览器再打开 → 再次弹出
  7. 后台改标题和正文 → 刷新后显示新内容
  8. 后台 `enabled=false` → 刷新后不弹
  9. 未登录访问登录页 → 弹窗照常显示
  10. OPERATOR 角色登录后台 → 看不到"全局弹窗"菜单
  11. SUPER_ADMIN 角色登录后台 → 菜单可见，能编辑

## 10. Files to add / change

新增：
- `apps/server/prisma/migrations/<timestamp>_add_popup_table/migration.sql`（prisma migrate 自动生成）
- `apps/server/src/popup/popup.module.ts`
- `apps/server/src/popup/popup.controller.ts`
- `apps/server/src/popup/popup.service.ts`
- `apps/server/src/popup/dto/popup-update.dto.ts`
- `apps/admin/src/api/popup.ts`
- `apps/admin/src/pages/Popup/index.tsx`
- `apps/mobile/src/api/popup.ts`
- `apps/mobile/src/components/SitePopup/index.tsx`

修改：
- `apps/server/prisma/schema.prisma` —— 加 `Popup` model
- `apps/server/src/app.module.ts` —— 导入 `PopupModule`
- `packages/shared/src/types.ts` —— 加 `SitePopup` / `PopupUpdatePayload` interface
- `packages/shared/src/index.ts` —— 导出新增类型
- `apps/admin/src/App.tsx` —— 加路由
- `apps/admin/src/layouts/AdminLayout.tsx` —— 加菜单项 + 角色过滤
- `apps/mobile/src/app.tsx` —— 挂载 `<SitePopup />`

## 11. Out of scope (future)

- 富文本编辑器 / Markdown 渲染
- 多条弹窗优先级排队
- 弹窗按钮 + 跳转链接
- 服务端记录"已对哪些用户展示过" / 强制每个用户必须看到
- A/B 测试（不同用户群显示不同内容）
