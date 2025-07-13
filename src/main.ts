import { createApp } from 'vue'
import App from './App.vue'
import { useTheme } from '@/composables/use-theme'

import './style.scss'

import './demos/ipc'
// If you want use Node.js, the`nodeIntegration` needs to be enabled in the Main process.
// import './demos/node'

// Initialize theme before mounting app
const { initTheme } = useTheme()
initTheme()

createApp(App)
  .mount('#app')
  .$nextTick(() => {
    postMessage({ payload: 'removeLoading' }, '*')
  })
