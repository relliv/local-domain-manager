<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Add New Domain</DialogTitle>
        <DialogDescription>
          Enter the domain details to add it to your local domain manager.
        </DialogDescription>
      </DialogHeader>
      
      <Alert v-if="hostWarning" class="mb-4">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Host File Notice</AlertTitle>
        <AlertDescription>
          {{ hostWarning }}
        </AlertDescription>
      </Alert>
      
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="space-y-2">
          <Label htmlFor="parent">Parent Domain (optional)</Label>
          <select
            id="parent"
            v-model="formData.parent_id"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option :value="undefined">None (Root Domain)</option>
            <option v-for="domain in availableParents" :key="domain.id" :value="domain.id">
              {{ domain.name }}
            </option>
          </select>
        </div>
        <div class="space-y-2">
          <Label htmlFor="name">Domain Name</Label>
          <Input
            id="name"
            v-model="formData.name"
            placeholder="example.local"
            required
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="port">Port (optional)</Label>
          <Input
            id="port"
            v-model.number="formData.port"
            type="number"
            placeholder="80"
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="category">Category (optional)</Label>
          <Input
            id="category"
            v-model="formData.category"
            placeholder="Development"
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            v-model="formData.description"
            placeholder="Enter a description..."
          />
        </div>
        <div class="space-y-2">
          <Label htmlFor="tags">Tags (optional)</Label>
          <Input
            id="tags"
            v-model="formData.tags"
            placeholder="web, api, local"
          />
        </div>
        <div class="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            v-model:checked="formData.is_active"
          />
          <Label htmlFor="is_active" class="cursor-pointer">
            Active
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isSubmitting">
            {{ isSubmitting ? 'Adding...' : 'Add Domain' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, toRaw, onMounted } from 'vue'
import { AlertCircle } from 'lucide-vue-next'
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
import Alert from '@/components/ui/alert.vue'
import AlertTitle from '@/components/ui/alert-title.vue'
import AlertDescription from '@/components/ui/alert-description.vue'
import { domainApi } from '@/api/domain.api'
import type { DomainFormData, Domain } from '@/types/domain'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'domain-added': [domain: Domain]
}>()

const open = ref(props.open)
const isSubmitting = ref(false)
const hostWarning = ref('')
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

watch(open, async (newVal) => {
  emit('update:open', newVal)
  if (newVal) {
    // Load available parent domains when modal opens
    try {
      availableParents.value = await domainApi.getAllDomains()
    } catch (error) {
      console.error('Failed to load parent domains:', error)
    }
  } else {
    // Reset form when modal closes
    formData.value = {
      name: '',
      port: undefined,
      is_active: true,
      description: '',
      category: '',
      tags: '',
      parent_id: undefined
    }
  }
})

// Check if domain exists in host file when name changes
watch(() => formData.value.name, async (newName) => {
  if (newName && formData.value.is_active) {
    try {
      const exists = await domainApi.checkHostExists(newName)
      if (exists) {
        hostWarning.value = `Warning: ${newName} already exists in your host file. It will be updated with the new IP address.`
      } else {
        hostWarning.value = ''
      }
    } catch (error) {
      hostWarning.value = ''
    }
  } else {
    hostWarning.value = ''
  }
})

// Show/hide warning when active status changes
watch(() => formData.value.is_active, (isActive) => {
  if (!isActive) {
    hostWarning.value = ''
  } else if (formData.value.name) {
    // Re-check when toggling active
    domainApi.checkHostExists(formData.value.name).then(exists => {
      if (exists) {
        hostWarning.value = `Warning: ${formData.value.name} already exists in your host file. It will be updated with the new IP address.`
      }
    }).catch(() => {})
  }
})

const handleSubmit = async () => {
  isSubmitting.value = true
  hostWarning.value = ''
  
  try {
    const domain = await domainApi.createDomain(toRaw(formData.value))
    emit('domain-added', domain)
    open.value = false
  } catch (error: any) {
    console.error('Failed to create domain:', error)
    
    if (error.message.includes('DUPLICATE_DOMAIN:')) {
      const domainName = error.message.split('DUPLICATE_DOMAIN:')[1]
      alert(`The domain "${domainName}" already exists in the database. Please use a different domain name or edit the existing one.`)
    } else if (error.message.includes('cancelled') || error.message.includes('denied')) {
      alert('Administrator permission is required to modify the host file. Please grant permission when prompted.')
    } else if (error.message.includes('already exists')) {
      alert(error.message)
    } else {
      alert(`Failed to create domain: ${error.message}`)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>