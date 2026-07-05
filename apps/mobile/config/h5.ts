import path from 'path'
import { defineConfig } from '@tarojs/cli'
import { baseConfig } from './index'

/**
 * H5 target config.
 *
 * compile.include points at packages/shared/src so Taro's webpack5 runner
 * runs babel over the shared workspace package's TS source. Without this,
 * webpack rejects `as const` and type annotations from the shared package
 * (see project memory lesson #2).
 */
const config = {
  ...baseConfig,
  h5: {
    ...baseConfig.h5,
    compile: {
      include: [path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src')]
    },
    devServer: {
      port: 10086,
      host: '0.0.0.0'
    }
  }
}

export default defineConfig<'webpack5'>(() => config)
