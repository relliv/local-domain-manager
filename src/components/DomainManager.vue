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
        <!-- Header -->
        <div class="grid grid-cols-5 gap-4 p-4 border-b font-medium text-sm text-muted-foreground">
          <div>Domain Name</div>
          <div>Port</div>
          <div>Status</div>
          <div>Category</div>
          <div class="text-right">Actions</div>
        </div>
        
        <!-- Tree View -->
        <div v-if="domainTree.length > 0">
          <DomainTreeItem
            v-for="domain in domainTree"
            :key="domain.id"
            :domain="domain"
            @toggle-status="toggleStatus"
            @edit="openEditModal"
            @delete="deleteDomain"
            @manage-proxy="openReverseProxyModal"
          />
        </div>
        
        <!-- Empty State -->
        <div v-else class="p-8 text-center text-muted-foreground">
          No domains found. Click "Add Domain" to create one.
        </div>
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

    <!-- Reverse Proxy Modal -->
    <ReverseProxyModal
      v-model:open="isReverseProxyModalOpen"
      :domain="selectedDomain"
      @proxy-updated="handleProxyUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import Button from '@/components/ui/button.vue'
import ThemeToggle from './ThemeToggle.vue'
import AddDomainModal from './AddDomainModal.vue'
import EditDomainModal from './EditDomainModal.vue'
import DomainTreeItem from './DomainTreeItem.vue'
import ReverseProxyModal from './ReverseProxyModal.vue'
import { domainApi } from '@/api/domain.api'
import type { Domain } from '@/types/domain'

const domainTree = ref<Domain[]>([])
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isReverseProxyModalOpen = ref(false)
const selectedDomain = ref<Domain | null>(null)

const loadDomains = async () => {
  try {
    domainTree.value = await domainApi.getDomainsTree()
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
  // Reload the tree to show the new domain in the correct position
  loadDomains()
}

const handleDomainUpdated = (updatedDomain: Domain) => {
  // Reload the tree to reflect the updates
  loadDomains()
}

const toggleStatus = async (domain: Domain) => {
  try {
    const updated = await domainApi.toggleDomainStatus(domain.id)
    if (updated) {
      // Reload the tree to reflect the status change
      loadDomains()
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
        // Reload the tree to reflect the deletion
        loadDomains()
      }
    } catch (error) {
      console.error('Failed to delete domain:', error)
    }
  }
}

const openReverseProxyModal = (domain: Domain) => {
  selectedDomain.value = domain
  isReverseProxyModalOpen.value = true
}

const handleProxyUpdated = () => {
  // Reload domains to reflect any changes
  loadDomains()
}

onMounted(() => {
  loadDomains()
})
</script>