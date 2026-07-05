const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '..', '..')

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  watchFolders: [
    projectRoot,
    workspaceRoot,
    path.resolve(workspaceRoot, 'node_modules', '.pnpm'),
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
}
