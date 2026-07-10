/**
 * ProLayout-based admin shell.
 *
 * Side menu matches the Phase 7 module list (Tasks 26-33) and is filtered by
 * the current user's role (RolesGuard, Task 24.3):
 *   - OPERATOR    → hides "管理员" and the whole "系统设置" group (settings + logs)
 *   - SUPER_ADMIN → sees everything
 *
 * The avatar dropdown shows the real user name (from getUser()) plus a role
 * label, and exposes logout wired to clearToken() + redirect.
 */
import React, { useMemo } from 'react';
import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Dropdown, Space, Typography, App as AntdApp, type MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  SoundOutlined,
  MessageOutlined,
  BlockOutlined,
  TagsOutlined,
  PictureOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  FileTextOutlined,
  LogoutOutlined,
  UserOutlined,
  ApartmentOutlined,
  ProfileOutlined,
  FileImageOutlined,
} from '@ant-design/icons';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearToken, getRole, getUser } from '@/store/auth';
import { Role } from '@qingmalaya/shared';

const { Text } = Typography;

const menuRouteMap: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/users': 'users',
  '/classes': 'classes',
  '/podcasts': 'podcasts',
  '/comments': 'comments',
  '/banned-keywords': 'banned-keywords',
  '/tags': 'tags',
  '/banners': 'banners',
  '/collections': 'collections',
  '/uploads': 'uploads',
  '/announcements': 'announcements',
  '/admins': 'admins',
  '/settings': 'settings',
  '/logs': 'logs',
};

const menuData: MenuDataItem[] = [
  { path: '/dashboard', name: '仪表盘', icon: <DashboardOutlined /> },
  {
    path: '/users-group',
    name: '用户管理',
    icon: <TeamOutlined />,
    children: [
      { path: '/users', name: '用户列表', icon: <UserOutlined /> },
      { path: '/classes', name: '班级管理', icon: <ApartmentOutlined /> },
    ],
  },
  { path: '/podcasts', name: '播客管理', icon: <SoundOutlined /> },
  { path: '/comments', name: '评论管理', icon: <MessageOutlined /> },
  { path: '/banned-keywords', name: '评论拦截', icon: <BlockOutlined /> },
  { path: '/tags', name: '标签管理', icon: <TagsOutlined /> },
  { path: '/banners', name: 'Banner管理', icon: <PictureOutlined /> },
  { path: '/collections', name: '精选集管理', icon: <ProfileOutlined /> },
  { path: '/uploads', name: '图片素材库', icon: <FileImageOutlined /> },
  { path: '/announcements', name: '公告管理', icon: <NotificationOutlined /> },
  { path: '/admins', name: '管理员', icon: <SafetyCertificateOutlined /> },
  {
    path: '/settings-group',
    name: '系统设置',
    icon: <SettingOutlined />,
    children: [
      { path: '/settings', name: '基础设置', icon: <SettingOutlined /> },
      { path: '/logs', name: '操作日志', icon: <FileTextOutlined /> },
    ],
  },
];

/**
 * Paths that only SUPER_ADMIN may see. OPERATOR gets these filtered out.
 * Both top-level group paths ("/admins", "/settings-group") and their leaf
 * paths ("/settings", "/logs") are listed so a deep link can't sneak past.
 */
const SUPER_ADMIN_ONLY_PATHS = new Set<string>([
  '/admins',
  '/settings-group',
  '/settings',
  '/logs',
]);

/**
 * Recursively filter menu items by role. A group with no surviving children
 * is dropped entirely (so OPERATOR sees no empty "系统设置" group).
 */
function filterMenuByRole(items: MenuDataItem[], role: Role | null): MenuDataItem[] {
  if (role === Role.SUPER_ADMIN) return items;
  // OPERATOR (and any non-super-admin) gets the restricted view.
  const result: MenuDataItem[] = [];
  for (const item of items) {
    if (item.path && SUPER_ADMIN_ONLY_PATHS.has(item.path)) continue;
    if (item.children && item.children.length > 0) {
      const children = filterMenuByRole(item.children, role);
      if (children.length === 0) continue;
      result.push({ ...item, children });
    } else {
      result.push(item);
    }
  }
  return result;
}

const ROLE_LABELS: Record<Role, string> = {
  [Role.STUDENT]: '学生',
  [Role.TEACHER]: '教师',
  [Role.OPERATOR]: '运营',
  [Role.SUPER_ADMIN]: '超级管理员',
};

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();

  const role = getRole();
  const user = getUser();

  const filteredMenu = useMemo(() => filterMenuByRole(menuData, role), [role]);

  const selectedKeys = useMemo(() => {
    // Match the longest registered path that the current URL starts with.
    const matches = Object.keys(menuRouteMap).filter((p) =>
      location.pathname.startsWith(p),
    );
    if (matches.length === 0) return ['/dashboard'];
    return [matches.sort((a, b) => b.length - a.length)[0]];
  }, [location.pathname]);

  const handleLogout = () => {
    clearToken();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  const displayName = user?.name ?? '管理员';
  const roleLabel = role ? ROLE_LABELS[role] : '';

  const avatarDropdown: MenuProps['items'] = [
    {
      key: 'user-menu',
      type: 'group',
      label: '当前用户',
      children: [
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: `个人信息 · ${roleLabel}`,
          disabled: true,
        },
        { type: 'divider' },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: handleLogout,
        },
      ],
    },
  ];

  return (
    <ProLayout
      title="清马拉雅后台"
      logo={false}
      layout="mix"
      fixedHeader
      fixSiderbar
      menu={{ request: async () => filteredMenu }}
      location={{ pathname: location.pathname }}
      selectedKeys={selectedKeys}
      menuItemRender={(item, defaultDom) => {
        if (!item.path) return defaultDom;
        return <Link to={item.path}>{defaultDom}</Link>;
      }}
      avatarProps={{
        icon: <UserOutlined />,
        size: 'small',
        render: (_, dom) => (
          <Dropdown menu={{ items: avatarDropdown }} placement="bottomRight">
            <Space style={{ cursor: 'pointer', padding: '0 8px' }}>
              {dom}
              <Text style={{ fontSize: 13 }}>{displayName}</Text>
            </Space>
          </Dropdown>
        ),
      }}
      footerRender={() => (
        <div
          style={{
            textAlign: 'center',
            color: '#727879',
            fontSize: 12,
            padding: '12px 0',
          }}
        >
          清马拉雅后台管理 · Qing Malaya Admin © {new Date().getFullYear()}
        </div>
      )}
    >
      <Outlet />
    </ProLayout>
  );
};

export default AdminLayout;
