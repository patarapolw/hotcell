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
  configureWebpack: {
    externals: {
      electron: 'commonjs2 electron'
    }
  },
  outputDir: process.env.OUT_DIR
}
