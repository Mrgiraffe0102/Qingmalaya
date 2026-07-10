export default {
  pages: [
    'pages/discovery/index',
    'pages/browse/index',
    'pages/create/index',
    'pages/profile/index',
    'pages/login/index',
    'pages/playback/index',
    'pages/upload/index',
    'pages/change-password/index',
    'pages/collection/index',
    'pages/markdown/index',
    'pages/messages/index',
    'pages/account-settings/index',
    'pages/favorites/index',
    'pages/history/index',
    'pages/ranking/index',
    'pages/about/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fbf9f8',
    navigationBarTitleText: '清马拉雅',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#727879',
    selectedColor: '#4d6265',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    // The native tabBar is hidden via CSS (see app.css) and replaced by the
    // custom floating-island nav in src/components/AppLayout. We keep the
    // list entry for the 4 real tab pages because Taro requires them to be
    // registered here for `switchTab` to route correctly. The "+" create
    // button is NOT a tab page — it uses `navigateTo` to /pages/upload/index.
    list: [
      {
        pagePath: 'pages/discovery/index',
        text: '发现'
      },
      {
        pagePath: 'pages/browse/index',
        text: '浏览'
      },
      {
        pagePath: 'pages/create/index',
        text: '创作'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的'
      }
    ]
  }
}
