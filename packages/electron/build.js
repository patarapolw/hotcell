const path = require('path')
const { spawnSync } = require('child_process')
const fs = require('fs')

const concurrently = require('concurrently')
const { quote } = require('shlex')

const pkg = require('./package.json')
const { dependencies } = require('../server/package.json')

if (Object.keys(dependencies).some((k) => !pkg.dependencies[k])) {
  Object.assign(pkg.dependencies, dependencies)
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))

  spawnSync('npm', ['i'], {
    stdio: 'inherit'
  })
}

const argv = process.argv.slice(2)
const isWatch = argv.includes('--watch')

concurrently([
  `npx tsc -P src/tsconfig.json ${isWatch ? '--watch' : ''}`,
  `cd ../server && npm run build -- --outDir ${quote(path.resolve('lib/server'))} ${isWatch ? '--watch' : ''}`,
  `cd ../web && OUT_DIR=${quote(path.resolve('lib/web'))} npm run build ${isWatch ? '-- --watch' : ''}`
])
