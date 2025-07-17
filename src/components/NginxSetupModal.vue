<template>
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
    <div class="fixed inset-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-lg">
      <div class="bg-card rounded-lg shadow-lg border p-6">
        <h2 class="text-2xl font-bold mb-4">Nginx Setup Required</h2>
        
        <div v-if="!nginxInstalled" class="space-y-4">
          <Alert>
            <AlertCircle class="h-4 w-4" />
            <AlertTitle>Nginx Not Found</AlertTitle>
            <AlertDescription>
              Nginx is not installed on your system. Please install nginx first to use reverse proxy features.
            </AlertDescription>
          </Alert>
          
          <div class="text-sm text-muted-foreground">
            <p class="mb-2">Install nginx using:</p>
            <code v-if="platform === 'darwin'" class="block bg-muted p-2 rounded">
              brew install nginx
            </code>
            <code v-else-if="platform === 'linux'" class="block bg-muted p-2 rounded">
              sudo apt-get install nginx
            </code>
            <code v-else class="block bg-muted p-2 rounded">
              Download from nginx.org
            </code>
          </div>
          
          <Button @click="checkNginxAgain" class="w-full">
            Check Again
          </Button>
        </div>
        
        <div v-else class="space-y-4">
          <div class="space-y-2">
            <Label>Nginx Configuration Directory</Label>
            <div class="flex gap-2">
              <Input
                v-model="nginxPath"
                placeholder="/etc/nginx"
                readonly
                class="flex-1"
              />
              <Button @click="selectFolder" variant="outline">
                Browse
              </Button>
            </div>
            <p class="text-sm text-muted-foreground">
              {{ detectedPath ? `Detected: ${detectedPath}` : 'Please select your nginx configuration directory' }}
            </p>
          </div>
          
          <Alert v-if="error">
            <AlertCircle class="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
          
          <div class="flex gap-2">
            <Button
              @click="skipSetup"
              variant="outline"
              class="flex-1"
            >
              Skip for Now
            </Button>
            <Button
              @click="saveSettings"
              :disabled="!nginxPath || saving"
              class="flex-1"
            >
              {{ saving ? 'Saving...' : 'Save Settings' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AlertCircle } from 'lucide-vue-next';
import Button from '@/components/ui/button.vue';
import Input from '@/components/ui/input.vue';
import Label from '@/components/ui/label.vue';
import Alert from '@/components/ui/alert.vue';
import AlertTitle from '@/components/ui/alert-title.vue';
import AlertDescription from '@/components/ui/alert-description.vue';
import { nginxApi } from '@/api/nginx.api';
import { settingsApi } from '@/api/settings.api';

const emit = defineEmits<{
  'setup-complete': []
}>();

const nginxInstalled = ref(false);
const nginxPath = ref('');
const detectedPath = ref('');
const error = ref('');
const saving = ref(false);
const platform = ref(process.platform);

onMounted(async () => {
  await checkNginx();
});

const checkNginx = async () => {
  try {
    nginxInstalled.value = await nginxApi.isInstalled();
    if (nginxInstalled.value) {
      const detected = await nginxApi.detectPath();
      if (detected) {
        detectedPath.value = detected;
        nginxPath.value = detected;
      }
    }
  } catch (err: any) {
    error.value = err.message;
  }
};

const checkNginxAgain = async () => {
  error.value = '';
  await checkNginx();
};

const selectFolder = async () => {
  try {
    const folder = await nginxApi.selectFolder();
    if (folder) {
      nginxPath.value = folder;
    }
  } catch (err: any) {
    error.value = err.message;
  }
};

const saveSettings = async () => {
  if (!nginxPath.value) return;
  
  saving.value = true;
  error.value = '';
  
  try {
    await settingsApi.setNginxPath(nginxPath.value);
    emit('setup-complete');
  } catch (err: any) {
    error.value = err.message;
  } finally {
    saving.value = false;
  }
};

const skipSetup = () => {
  emit('setup-complete');
};
</script>