<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon">
        <Sun v-if="theme === 'light'" class="h-[1.2rem] w-[1.2rem]" />
        <Moon v-else-if="theme === 'dark'" class="h-[1.2rem] w-[1.2rem]" />
        <Monitor v-else class="h-[1.2rem] w-[1.2rem]" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="updateTheme('light')">
        <Sun class="mr-2 h-4 w-4" />
        <span>Light</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="updateTheme('dark')">
        <Moon class="mr-2 h-4 w-4" />
        <span>Dark</span>
      </DropdownMenuItem>
      <DropdownMenuItem @click="updateTheme('system')">
        <Monitor class="mr-2 h-4 w-4" />
        <span>System</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import DropdownMenu from '@/components/ui/dropdown-menu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu-content.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu-item.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu-trigger.vue'
import { useTheme } from '@/composables/use-theme'

const { theme, updateTheme } = useTheme()
</script>