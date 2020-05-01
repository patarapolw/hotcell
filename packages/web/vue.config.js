const { spawnSync } = require('child_process')

if (process.env.NODE_ENV === 'production') {
  spawnSync('npm', ['run', 'electron:build'], {
    stdio: 'inherit',
    cwd: '../server'
  })
}

process.env.VUE_APP_PORT = process.env.PORT || '12345'

module.exports = {
  devServer: {
    proxy: {
      '^/api': {
        target: `http://localhost:${process.env.VUE_APP_PORT}`
      }
    },
    port: 8080
  },
  pluginOptions: {
    electronBuilder: {
      builderOptions: {
        appId: 'dev.polvcode.hotcell',
        productName: 'HotCell',
        fileAssociations: [
          {
            ext: ['sqlite', 'sqlite3', 'db']
          }
        ],
        forceCodeSigning: false
      }
    }
  }
}
