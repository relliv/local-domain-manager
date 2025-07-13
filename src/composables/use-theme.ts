import { ref, watch, onMounted } from 'vue'

type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>('system')
const isDark = ref(false)

export function useTheme() {
  const updateTheme = (newTheme: Theme) => {
    theme.value = newTheme
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  const applyTheme = (selectedTheme: Theme) => {
    const root = document.documentElement
    
    if (selectedTheme === 'dark' || 
        (selectedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark')
      isDark.value = true
    } else {
      root.classList.remove('dark')
      isDark.value = false
    }
  }

  const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const initialTheme = savedTheme || 'system'
    theme.value = initialTheme
    applyTheme(initialTheme)
  }

  // Watch for system theme changes
  onMounted(() => {
    initTheme()
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (theme.value === 'system') {
        applyTheme('system')
      }
    })
  })

  // Watch theme changes
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    theme,
    isDark,
    updateTheme,
    initTheme
  }
}