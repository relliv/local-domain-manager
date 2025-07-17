<template>
  <div class="container mx-auto p-6 max-w-4xl">
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold">Settings</h1>
        <p class="text-muted-foreground">Manage your application settings</p>
      </div>

      <!-- Nginx Settings -->
      <Card>
        <CardHeader>
          <CardTitle>Nginx Configuration</CardTitle>
          <CardDescription>
            Configure your nginx installation path and settings
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>Nginx Configuration Path</Label>
            <div class="flex gap-2">
              <Input
                v-model="nginxPath"
                placeholder="/etc/nginx"
                readonly
                class="flex-1"
              />
              <Button @click="selectNginxPath" variant="outline">
                Browse
              </Button>
            </div>
            <p class="text-sm text-muted-foreground" v-if="nginxPath">
              Current path: {{ nginxPath }}
            </p>
          </div>

          <div class="flex items-center space-x-2">
            <Button @click="testNginxConfig" :disabled="testing">
              <CheckCircle2 class="w-4 h-4 mr-2" v-if="!testing" />
              {{ testing ? 'Testing...' : 'Test Configuration' }}
            </Button>
            <Button @click="reloadNginx" :disabled="reloading" variant="outline">
              <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': reloading }" />
              {{ reloading ? 'Reloading...' : 'Reload Nginx' }}
            </Button>
          </div>

          <Alert v-if="nginxStatus" :class="nginxStatus.success ? 'border-green-500' : 'border-destructive'">
            <CheckCircle2 v-if="nginxStatus.success" class="h-4 w-4 text-green-500" />
            <AlertCircle v-else class="h-4 w-4" />
            <AlertTitle>{{ nginxStatus.success ? 'Success' : 'Error' }}</AlertTitle>
            <AlertDescription class="whitespace-pre-line font-mono text-sm">{{ nginxStatus.message }}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <!-- General Settings -->
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            General application preferences
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Auto-sync with Host File</Label>
              <p class="text-sm text-muted-foreground">
                Automatically sync domains with system host file on startup
              </p>
            </div>
            <Switch
              v-model:checked="autoSync"
              @update:checked="updateAutoSync"
            />
          </div>

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Show Inactive Domains</Label>
              <p class="text-sm text-muted-foreground">
                Display inactive domains in the domain list
              </p>
            </div>
            <Switch
              v-model:checked="showInactive"
              @update:checked="updateShowInactive"
            />
          </div>

          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Dark Mode</Label>
              <p class="text-sm text-muted-foreground">
                Toggle dark mode theme
              </p>
            </div>
            <Switch
              v-model:checked="darkMode"
              @update:checked="toggleDarkMode"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Advanced Settings -->
      <Card>
        <CardHeader>
          <CardTitle>Advanced Settings</CardTitle>
          <CardDescription>
            Advanced configuration options
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label>Default Domain IP Address</Label>
            <Input
              v-model="defaultIp"
              placeholder="127.0.0.1"
              @blur="updateDefaultIp"
            />
            <p class="text-sm text-muted-foreground">
              Default IP address for new domains
            </p>
          </div>

          <div class="space-y-2">
            <Label>Default Domain Port</Label>
            <Input
              v-model="defaultPort"
              type="number"
              placeholder="80"
              @blur="updateDefaultPort"
            />
            <p class="text-sm text-muted-foreground">
              Default port for new domains
            </p>
          </div>

          <Separator />

          <div class="space-y-2">
            <h4 class="font-semibold">Danger Zone</h4>
            <div class="flex gap-2">
              <Button 
                @click="syncAllDomains" 
                variant="outline"
                :disabled="syncing"
              >
                {{ syncing ? 'Syncing...' : 'Sync All Domains' }}
              </Button>
              <Button 
                @click="clearAllData" 
                variant="destructive"
                :disabled="clearing"
              >
                {{ clearing ? 'Clearing...' : 'Clear All Data' }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- About -->
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Version</span>
            <span class="font-mono">1.0.0</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Platform</span>
            <span class="font-mono">{{ platform }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Electron</span>
            <span class="font-mono">{{ electronVersion }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-vue-next';
import Card from '@/components/ui/card.vue';
import CardHeader from '@/components/ui/card-header.vue';
import CardTitle from '@/components/ui/card-title.vue';
import CardDescription from '@/components/ui/card-description.vue';
import CardContent from '@/components/ui/card-content.vue';
import Button from '@/components/ui/button.vue';
import Input from '@/components/ui/input.vue';
import Label from '@/components/ui/label.vue';
import Switch from '@/components/ui/switch.vue';
import Alert from '@/components/ui/alert.vue';
import AlertTitle from '@/components/ui/alert-title.vue';
import AlertDescription from '@/components/ui/alert-description.vue';
import Separator from '@/components/ui/separator.vue';
import { settingsApi } from '@/api/settings.api';
import { nginxApi } from '@/api/nginx.api';
import { domainApi } from '@/api/domain.api';
import { systemApi } from '@/api/system.api';

const emit = defineEmits<{
  'settings-changed': []
}>();

// Nginx settings
const nginxPath = ref('');
const testing = ref(false);
const reloading = ref(false);
const nginxStatus = ref<{ success: boolean; message: string } | null>(null);

// General settings
const autoSync = ref(true);
const showInactive = ref(true);
const darkMode = ref(false);

// Advanced settings
const defaultIp = ref('127.0.0.1');
const defaultPort = ref('80');
const syncing = ref(false);
const clearing = ref(false);

// About
const platform = ref('');
const electronVersion = ref('');

onMounted(async () => {
  await loadSettings();
  platform.value = await systemApi.getPlatform();
  electronVersion.value = window.versions?.electron || 'Unknown';
  
  // Check current theme
  darkMode.value = document.documentElement.classList.contains('dark');
});

const loadSettings = async () => {
  try {
    const settings = await settingsApi.getAllSettings();
    
    // Load nginx path
    const nginxPathSetting = settings.find(s => s.key === 'nginx_path');
    if (nginxPathSetting) {
      nginxPath.value = nginxPathSetting.value;
    }
    
    // Load other settings
    const autoSyncSetting = settings.find(s => s.key === 'auto_sync');
    autoSync.value = autoSyncSetting?.value !== 'false';
    
    const showInactiveSetting = settings.find(s => s.key === 'show_inactive');
    showInactive.value = showInactiveSetting?.value !== 'false';
    
    const defaultIpSetting = settings.find(s => s.key === 'default_ip');
    defaultIp.value = defaultIpSetting?.value || '127.0.0.1';
    
    const defaultPortSetting = settings.find(s => s.key === 'default_port');
    defaultPort.value = defaultPortSetting?.value || '80';
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

const selectNginxPath = async () => {
  try {
    const folder = await nginxApi.selectFolder();
    if (folder) {
      nginxPath.value = folder;
      await settingsApi.setNginxPath(folder);
      nginxStatus.value = {
        success: true,
        message: 'Nginx path updated successfully'
      };
    }
  } catch (error: any) {
    nginxStatus.value = {
      success: false,
      message: error.message || 'Failed to update nginx path'
    };
  }
};

const testNginxConfig = async () => {
  testing.value = true;
  nginxStatus.value = null;
  
  try {
    const result = await nginxApi.testConfig();
    if (result.valid) {
      let message = '✓ Nginx configuration is valid\n\n';
      if (result.message) {
        // Clean up the nginx test output
        message += result.message.replace(/nginx: /g, '')
                                .replace(/test is successful/g, 'Test successful')
                                .trim();
      } else {
        message += 'Configuration test passed successfully.';
      }
      nginxStatus.value = {
        success: true,
        message
      };
    } else {
      // Parse the error message to make it more readable
      let errorMessage = result.error || 'Configuration test failed';
      
      // Check for common issues
      if (errorMessage.includes('Permission denied')) {
        errorMessage = 'Permission denied. Try running the test with elevated privileges:\n\n' +
                       '• macOS/Linux: sudo nginx -t\n' +
                       '• Windows: Run as administrator';
      } else if (errorMessage.includes('nginx: command not found')) {
        errorMessage = 'Nginx is not installed or not in PATH.\n\n' +
                       'Please install nginx or add it to your system PATH.';
      } else {
        // Clean up nginx test output
        errorMessage = errorMessage.replace(/nginx: \[emerg\]/g, 'Error:')
                                 .replace(/nginx: configuration file .* test failed/g, '')
                                 .trim();
      }
      
      nginxStatus.value = {
        success: false,
        message: `✗ Nginx configuration is invalid\n\n${errorMessage}`
      };
    }
  } catch (error: any) {
    nginxStatus.value = {
      success: false,
      message: `Failed to test configuration: ${error.message}`
    };
  } finally {
    testing.value = false;
  }
};

const reloadNginx = async () => {
  reloading.value = true;
  nginxStatus.value = null;
  
  try {
    await nginxApi.reload();
    nginxStatus.value = {
      success: true,
      message: 'Nginx reloaded successfully'
    };
  } catch (error: any) {
    // Check if it's a permission error
    const errorMessage = error.message || 'Failed to reload nginx';
    const isPermissionError = errorMessage.includes('Please reload it manually');
    
    nginxStatus.value = {
      success: false,
      message: isPermissionError 
        ? `${errorMessage}\n\nYou can reload nginx manually using:\n• macOS/Linux: sudo nginx -s reload\n• Windows: nginx -s reload`
        : errorMessage
    };
  } finally {
    reloading.value = false;
  }
};

const updateAutoSync = async (value: boolean) => {
  try {
    await settingsApi.setSetting('auto_sync', value.toString(), 'Automatically sync domains with host file on startup');
    emit('settings-changed');
  } catch (error) {
    console.error('Failed to update auto sync setting:', error);
    autoSync.value = !value; // Revert
  }
};

const updateShowInactive = async (value: boolean) => {
  try {
    await settingsApi.setSetting('show_inactive', value.toString(), 'Show inactive domains in the list');
    emit('settings-changed');
  } catch (error) {
    console.error('Failed to update show inactive setting:', error);
    showInactive.value = !value; // Revert
  }
};

const toggleDarkMode = (value: boolean) => {
  if (value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  // You could persist this to settings if needed
};

const updateDefaultIp = async () => {
  try {
    await settingsApi.setSetting('default_ip', defaultIp.value, 'Default IP address for new domains');
  } catch (error) {
    console.error('Failed to update default IP:', error);
  }
};

const updateDefaultPort = async () => {
  try {
    await settingsApi.setSetting('default_port', defaultPort.value, 'Default port for new domains');
  } catch (error) {
    console.error('Failed to update default port:', error);
  }
};

const syncAllDomains = async () => {
  if (!confirm('This will sync all domains with the host file and nginx. Continue?')) {
    return;
  }
  
  syncing.value = true;
  
  try {
    await domainApi.syncHostFile();
    await nginxApi.syncAll();
    alert('All domains synced successfully!');
    emit('settings-changed');
  } catch (error: any) {
    alert(`Failed to sync domains: ${error.message}`);
  } finally {
    syncing.value = false;
  }
};

const clearAllData = async () => {
  if (!confirm('This will delete ALL domains and settings. This action cannot be undone. Are you sure?')) {
    return;
  }
  
  if (!confirm('Are you REALLY sure? All your domain configurations will be lost!')) {
    return;
  }
  
  clearing.value = true;
  
  try {
    // Get all domains and delete them
    const domains = await domainApi.getAllDomains();
    for (const domain of domains) {
      await domainApi.deleteDomain(domain.id);
    }
    
    alert('All data cleared successfully!');
    emit('settings-changed');
  } catch (error: any) {
    alert(`Failed to clear data: ${error.message}`);
  } finally {
    clearing.value = false;
  }
};
</script>