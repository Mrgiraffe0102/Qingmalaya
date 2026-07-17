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
    // In pnpm monorepos transitive deps (e.g. metro-runtime, used by
    // @tarojs/rn-supporter/entry-file.js) are nested under
    // node_modules/.pnpm/<name>@<version>/node_modules/<name>/. The default
    // nodeModulesPaths (just the project / workspace node_modules) can't see
    // through pnpm's symlink layout, so we also list the pnpm virtual store
    // and disable hierarchical lookup to keep resolution flat.
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules', '.pnpm', 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules', '.pnpm'),
    ],
    disableHierarchicalLookup: true,
  },
}
