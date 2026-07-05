import { defineConfig } from '@tarojs/cli'
import { baseConfig } from './index'

/**
 * WeApp (微信小程序) target config.
 * Merges on top of the base config. The shared-tsx webpackChain rule from
 * baseConfig.mini.webpackChain already covers transpiling packages/shared/src.
 */
const config = {
  ...baseConfig,
  mini: {
    ...baseConfig.mini,
    // WeApp posts CSS through Taro's internal PostCSS pipeline; tailwind +
    // autoprefixer are added via postcss.config.js at the repo root of the app.
    postcss: {
      ...baseConfig.mini.postcss,
      autoprefixer: { enable: true, config: {} },
      tailwindcss: { enable: true, config: {} }
    }
  }
}

export default defineConfig<'webpack5'>(() => config)
