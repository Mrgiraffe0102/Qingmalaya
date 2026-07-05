import path from 'path'
import { defineConfig } from '@tarojs/cli'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Base Taro config shared across H5 / WeApp / RN targets.
 * Each target file (config/h5.ts, config/weapp.ts, config/rn.ts) imports
 * this object, merges its target-specific slice on top, and re-exports via
 * defineConfig. Taro picks the target file based on `--type`.
 *
 * The shared workspace package (packages/shared/src) ships raw TS source.
 * Both mini and h5 webpack chains below add a babel-loader rule for that
 * folder so `as const`, type annotations, and TS path mappings compile.
 * config/h5.ts additionally declares `compile.include` for the same path
 * (required by Taro's H5 runner — see project memory lesson #2).
 */

const sharedSrcPath = path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src')

export const baseConfig = {
  projectName: 'qingmalaya-mobile',
  date: '2024-01-01',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: { patterns: [], options: {} },
  framework: 'react',
  compiler: { type: 'webpack5', prebundle: { enable: false } },
  cache: { enable: false },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    webpackChain(chain: any) {
      chain.module.rule('shared-tsx').test(/\.tsx?$/).include.add(sharedSrcPath).end().use('babel-loader').loader(require.resolve('babel-loader')).options({ presets: [['taro', { framework: 'react', ts: true, compiler: 'webpack5' }]] })
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkhash:8].js'
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
      filename: 'css/[name].[hash].css',
      chunkFilename: 'css/[name].[chunkhash].css'
    },
    postcss: {
      autoprefixer: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    },
    webpackChain(chain: any) {
      chain.module.rule('shared-tsx').test(/\.tsx?$/).include.add(sharedSrcPath).end().use('babel-loader').loader(require.resolve('babel-loader')).options({ presets: [['taro', { framework: 'react', ts: true, compiler: 'webpack5' }]] })
    }
  },
  rn: {
    appName: 'qingmalaya',
    postcss: {
      cssModules: { enable: false }
    }
  }
}

export default defineConfig<'webpack5'>(() => baseConfig)
