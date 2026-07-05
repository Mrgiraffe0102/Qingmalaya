/**
 * Ant Design theme tokens for the admin console.
 * Derived from DESIGN.md — primary color #4d6265, Inter typeface, 8px default radius.
 * Do NOT hand-tune the primary color; realign against DESIGN.md.
 */
import type { ThemeConfig } from 'antd';

export const ADMIN_PRIMARY = '#4d6265';
export const ADMIN_FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const adminTheme: ThemeConfig = {
  token: {
    colorPrimary: ADMIN_PRIMARY,
    colorInfo: ADMIN_PRIMARY,
    colorLink: ADMIN_PRIMARY,
    colorSuccess: '#556158',
    colorWarning: '#c87f3a',
    colorError: '#ba1a1a',
    colorTextBase: '#1b1c1c',
    colorBgBase: '#ffffff',
    colorBgLayout: '#fbf9f8',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    fontFamily: ADMIN_FONT_FAMILY,
    fontSize: 14,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      bodyBg: '#fbf9f8',
      siderBg: '#ffffff',
      headerHeight: 56,
    },
    Menu: {
      itemHeight: 40,
      subMenuItemBg: 'transparent',
      itemSelectedBg: 'rgba(77, 98, 101, 0.10)',
      itemSelectedColor: ADMIN_PRIMARY,
      itemActiveBg: 'rgba(77, 98, 101, 0.06)',
    },
    Button: {
      controlHeight: 36,
      controlHeightLG: 44,
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};

export default adminTheme;
