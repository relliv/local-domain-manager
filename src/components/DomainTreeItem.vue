<template>
  <div class="domain-tree-item">
    <div 
      class="domain-row"
      :style="{ paddingLeft: `${(domain.level || 0) * 24 + 8}px` }"
      :class="{ 
        'hover:bg-muted/50': true,
        'bg-muted/30': domain.parent_id
      }"
    >
      <div class="flex items-center gap-2 flex-1">
        <button
          v-if="domain.children && domain.children.length > 0"
          @click="toggleExpanded"
          class="w-4 h-4 flex items-center justify-center hover:bg-muted rounded"
        >
          <ChevronRight v-if="!isExpanded" class="w-3 h-3" />
          <ChevronDown v-else class="w-3 h-3" />
        </button>
        <div v-else class="w-4"></div>
        
        <div class="flex-1 grid grid-cols-5 gap-4 items-center py-2">
          <div class="flex items-center gap-2">
            <Globe v-if="!domain.parent_id" class="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Link2 v-else class="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <button
              @click="openDomainInBrowser"
              class="font-medium hover:text-primary hover:underline cursor-pointer text-left bg-transparent border-0 p-0"
            >
              {{ domain.name }}
            </button>
          </div>
          <div class="text-sm text-muted-foreground">{{ domain.port || 80 }}</div>
          <div>
            <span 
              :class="[
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                domain.is_active 
                  ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
              ]"
            >
              {{ domain.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="text-sm text-muted-foreground">{{ domain.category || '-' }}</div>
          <div class="flex items-center gap-2 justify-end pr-2">
            <Switch
              :checked="domain.is_active"
              @update:checked="$emit('toggle-status', domain)"
            />
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon">
                  <MoreVertical class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  v-if="!domain.parent_id"
                  @click="$emit('manage-proxy', domain)"
                >
                  <Server class="w-4 h-4 mr-2" />
                  <span>Manage Proxy</span>
                </DropdownMenuItem>
                <DropdownMenuItem @click="$emit('edit', domain)">
                  <Edit class="w-4 h-4 mr-2" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem @click="$emit('delete', domain)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="isExpanded && domain.children && domain.children.length > 0">
      <DomainTreeItem
        v-for="child in domain.children"
        :key="child.id"
        :domain="child"
        @toggle-status="$emit('toggle-status', $event)"
        @edit="$emit('edit', $event)"
        @delete="$emit('delete', $event)"
        @manage-proxy="$emit('manage-proxy', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight, ChevronDown, Edit, Trash2, Server, Globe, Link2, MoreVertical } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Switch from '@/components/ui/switch.vue'
import DropdownMenu from '@/components/ui/dropdown-menu.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu-trigger.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu-content.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu-item.vue'
import type { Domain } from '@/types/domain'

interface Props {
  domain: Domain
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'toggle-status': [domain: Domain]
  'edit': [domain: Domain]
  'delete': [domain: Domain]
  'manage-proxy': [domain: Domain]
}>()

const isExpanded = ref(props.domain.isExpanded ?? false)

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}

const getDomainUrl = () => {
  const protocol = 'http://'
  return `${protocol}${props.domain.name}`
}

const openDomainInBrowser = async () => {
  try {
    await window.ipcRenderer.invoke('open-url', getDomainUrl())
  } catch (error) {
    console.error('Failed to open domain in browser:', error)
  }
}
</script>

<style scoped>
.domain-row {
  border-bottom: 1px solid var(--border);
  transition: background-color 0.2s;
}

.domain-tree-item:last-child .domain-row {
  border-bottom: none;
}
</style>