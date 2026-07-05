import { defineConfig } from '@tarojs/cli'
import { baseConfig } from './index'

/**
 * React Native target config.
 * RN uses Metro, not webpack5; the webpackChain rules from baseConfig are
 * ignored. RN-specific shared-package transpilation is handled by Metro's
 * resolver / babelrc out of the box.
 */
const config = {
  ...baseConfig,
  rn: {
    ...baseConfig.rn
  }
}

export default defineConfig<'webpack5'>(() => config)
