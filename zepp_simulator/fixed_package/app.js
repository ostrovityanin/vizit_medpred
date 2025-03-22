import { getApp } from '@zos/app'

App({
  globalData: {
    // Глобальные данные приложения
    token: '',
    userId: '',
    serverUrl: 'http://example.com/api'
  },
  onCreate() {
    console.log('App onCreate')
  }
})