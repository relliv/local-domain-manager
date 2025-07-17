<template>
  <div class="min-h-screen bg-background">
    <!-- Navigation -->
    <nav class="border-b">
      <div class="container mx-auto px-6">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center space-x-8">
            <h1 class="text-xl font-bold">Local Domain Manager</h1>
            <div class="flex space-x-1">
              <Button
                variant="ghost"
                :class="{ 'bg-accent': currentView === 'domains' }"
                @click="currentView = 'domains'"
              >
                <Globe class="w-4 h-4 mr-2" />
                Domains
              </Button>
              <Button
                variant="ghost"
                :class="{ 'bg-accent': currentView === 'settings' }"
                @click="currentView = 'settings'"
              >
                <Settings class="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>

    <!-- Content -->
    <main>
      <DomainManager v-if="currentView === 'domains'" />
      <SettingsPage v-else-if="currentView === 'settings'" @settings-changed="onSettingsChanged" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Globe, Settings } from 'lucide-vue-next';
import Button from '@/components/ui/button.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import DomainManager from './DomainManager.vue';
import SettingsPage from './SettingsPage.vue';

const currentView = ref<'domains' | 'settings'>('domains');

const onSettingsChanged = () => {
  // Force refresh domain manager if needed
  if (currentView.value === 'domains') {
    // The domain manager will handle its own refresh
  }
};
</script>