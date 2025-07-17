<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Edit Domain</DialogTitle>
        <DialogDescription>
          Update the domain details.
        </DialogDescription>
      </DialogHeader>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label htmlFor="edit-parent">Parent Domain (optional)</Label>
          <select
            id="edit-parent"
            v-model="formData.parent_id"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option :value="undefined">None (Root Domain)</option>
            <option v-for="parent in availableParents" :key="parent.id" :value="parent.id">
              {{ getIndentedName(parent) }}
            </option>
          </select>
        </div>
        <div class="space-y-2">
          <Label htmlFor="edit-name">Domain Name</Label>
          <Input
            id="edit-name"
            v-model="formData.name"
            placeholder="example.local"
            required
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="edit-port">Port (optional)</Label>
          <Input
            id="edit-port"
            v-model.number="formData.port"
            type="number"
            placeholder="80"
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="edit-category">Category (optional)</Label>
          <Input
            id="edit-category"
            v-model="formData.category"
            placeholder="Development"
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="edit-description">Description (optional)</Label>
          <Textarea
            id="edit-description"
            v-model="formData.description"
            placeholder="Enter a description..."
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="edit-tags">Tags (optional)</Label>
          <Input
            id="edit-tags"
            v-model="formData.tags"
            placeholder="web, api, local"
          />
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox
            id="edit-is_active"
            v-model:checked="formData.is_active"
          />
          <Label htmlFor="edit-is_active" class="cursor-pointer">
            Active
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Updating...' : 'Update Domain' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/dialog.vue'
import DialogContent from '@/components/ui/dialog-content.vue'
import DialogHeader from '@/components/ui/dialog-header.vue'
import DialogTitle from '@/components/ui/dialog-title.vue'
import DialogDescription from '@/components/ui/dialog-description.vue'
import DialogFooter from '@/components/ui/dialog-footer.vue'
import Button from '@/components/ui/button.vue'
import Input from '@/components/ui/input.vue'
import Label from '@/components/ui/label.vue'
import Textarea from '@/components/ui/textarea.vue'
import Checkbox from '@/components/ui/checkbox.vue'
import { domainApi } from '@/api/domain.api'
import type { DomainFormData, Domain } from '@/types/domain'

const props = defineProps<{
  open: boolean
  domain: Domain | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'domain-updated': [domain: Domain]
}>()

const open = ref(props.open)
const isSubmitting = ref(false)
const availableParents = ref<Domain[]>([])

const formData = ref<DomainFormData>({
  name: '',
  port: undefined,
  is_active: true,
  description: '',
  category: '',
  tags: '',
  parent_id: undefined
})

watch(() => props.open, (newVal) => {
  open.value = newVal
})

watch(() => props.domain, (newDomain) => {
  if (newDomain) {
    formData.value = {
      name: newDomain.name,
      port: newDomain.port,
      is_active: newDomain.is_active,
      description: newDomain.description || '',
      category: newDomain.category || '',
      tags: newDomain.tags || '',
      parent_id: newDomain.parent_id
    }
  }
})

watch(open, async (newVal) => {
  emit('update:open', newVal)
  if (newVal) {
    // Load available parent domains when modal opens
    try {
      const allDomains = await domainApi.getAllDomains()
      // Filter out the current domain and its descendants to prevent circular references
      availableParents.value = allDomains.filter(d => {
        if (!props.domain) return true
        if (d.id === props.domain.id) return false
        // Also filter out any domains that have this domain as a parent (to prevent circular references)
        let parent = d
        while (parent.parent_id) {
          if (parent.parent_id === props.domain.id) return false
          parent = allDomains.find(p => p.id === parent.parent_id) || parent
          if (!parent || parent === d) break
        }
        return true
      })
    } catch (error) {
      console.error('Failed to load parent domains:', error)
    }
  }
})

// Helper function to get domain level for indentation
const getDomainLevel = (domain: Domain): number => {
  let level = 0
  let current = domain
  while (current.parent_id) {
    level++
    current = availableParents.value.find(d => d.id === current.parent_id) || current
    if (!current || current === domain) break // Prevent infinite loop
  }
  return level
}

// Helper function to display indented domain names
const getIndentedName = (domain: Domain): string => {
  const level = getDomainLevel(domain)
  return '  '.repeat(level) + domain.name
}

const handleSubmit = async () => {
  if (!props.domain) return
  
  isSubmitting.value = true
  try {
    const updatedDomain = await domainApi.updateDomain(props.domain.id, formData.value)
    if (updatedDomain) {
      emit('domain-updated', updatedDomain)
      open.value = false
    }
  } catch (error) {
    console.error('Failed to update domain:', error)
    alert('Failed to update domain. Please try again.')
  } finally {
    isSubmitting.value = false
  }
}
</script>