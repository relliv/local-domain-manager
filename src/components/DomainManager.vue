<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Domain Manager</h1>
      <div class="flex items-center gap-4">
        <ThemeToggle />
        <Button @click="openAddModal">
          <Plus class="w-4 h-4 mr-2" />
          Add Domain
        </Button>
      </div>
    </div>

    <div class="bg-card rounded-lg shadow-sm border">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-4">Domain Name</th>
              <th class="text-left p-4">Port</th>
              <th class="text-left p-4">Status</th>
              <th class="text-left p-4">Category</th>
              <th class="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="domain in domains" :key="domain.id" class="border-b hover:bg-muted/50">
              <td class="p-4 font-medium">{{ domain.name }}</td>
              <td class="p-4">{{ domain.port || 80 }}</td>
              <td class="p-4">
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
              </td>
              <td class="p-4">{{ domain.category || '-' }}</td>
              <td class="p-4">
                <div class="flex items-center gap-2">
                  <Switch
                    :checked="domain.is_active"
                    @update:checked="toggleStatus(domain)"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon"
                    @click="openEditModal(domain)"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    @click="deleteDomain(domain)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
            <tr v-if="domains.length === 0">
              <td colspan="5" class="p-8 text-center text-muted-foreground">
                No domains found. Click "Add Domain" to create one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Domain Modal -->
    <AddDomainModal 
      v-model:open="isAddModalOpen"
      @domain-added="handleDomainAdded"
    />

    <!-- Edit Domain Modal -->
    <EditDomainModal 
      v-model:open="isEditModalOpen"
      :domain="selectedDomain"
      @domain-updated="handleDomainUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Edit, Trash2 } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import Switch from '@/components/ui/switch.vue'
import ThemeToggle from './ThemeToggle.vue'
import AddDomainModal from './AddDomainModal.vue'
import EditDomainModal from './EditDomainModal.vue'
import { domainApi } from '@/api/domain.api'
import type { Domain } from '@/types/domain'

const domains = ref<Domain[]>([])
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const selectedDomain = ref<Domain | null>(null)

const loadDomains = async () => {
  try {
    domains.value = await domainApi.getAllDomains()
  } catch (error) {
    console.error('Failed to load domains:', error)
  }
}

const openAddModal = () => {
  isAddModalOpen.value = true
}

const openEditModal = (domain: Domain) => {
  selectedDomain.value = domain
  isEditModalOpen.value = true
}

const handleDomainAdded = (domain: Domain) => {
  domains.value.push(domain)
}

const handleDomainUpdated = (updatedDomain: Domain) => {
  const index = domains.value.findIndex(d => d.id === updatedDomain.id)
  if (index !== -1) {
    domains.value[index] = updatedDomain
  }
}

const toggleStatus = async (domain: Domain) => {
  try {
    const updated = await domainApi.toggleDomainStatus(domain.id)
    if (updated) {
      const index = domains.value.findIndex(d => d.id === domain.id)
      if (index !== -1) {
        domains.value[index] = updated
      }
    }
  } catch (error: any) {
    console.error('Failed to toggle domain status:', error)
    if (error.message.includes('cancelled') || error.message.includes('denied')) {
      alert('Administrator permission is required to modify the host file. Please grant permission when prompted.')
    } else {
      alert(`Failed to toggle domain status: ${error.message}`)
    }
  }
}

const deleteDomain = async (domain: Domain) => {
  if (confirm(`Are you sure you want to delete ${domain.name}?`)) {
    try {
      const success = await domainApi.deleteDomain(domain.id)
      if (success) {
        domains.value = domains.value.filter(d => d.id !== domain.id)
      }
    } catch (error) {
      console.error('Failed to delete domain:', error)
    }
  }
}

onMounted(() => {
  loadDomains()
})
</script>