<template>
  <div class="min-h-screen bg-background">
    <NginxSetupModal v-if="showNginxSetup" @setup-complete="onNginxSetupComplete" />
    <DomainManager v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import DomainManager from "./components/DomainManager.vue";
import NginxSetupModal from "./components/NginxSetupModal.vue";
import { settingsApi } from './api/settings.api';

const showNginxSetup = ref(false);

onMounted(async () => {
  // Check if initial setup is complete
  const isSetupComplete = await settingsApi.isInitialSetupComplete();
  if (!isSetupComplete) {
    showNginxSetup.value = true;
  }
  
  // Listen for show-nginx-setup event from main process
  window.ipcRenderer.on('show-nginx-setup', () => {
    showNginxSetup.value = true;
  });
});

const onNginxSetupComplete = () => {
  showNginxSetup.value = false;
};</script>

<style>
</style>