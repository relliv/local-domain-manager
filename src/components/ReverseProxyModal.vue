<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Manage Reverse Proxy - {{ domain?.name }}</DialogTitle>
        <DialogDescription>
          Configure nginx reverse proxy settings for this domain
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto">
        <form @submit.prevent="handleSubmit" class="space-y-6 p-4">
          <!-- Basic Settings -->
          <div class="space-y-4">
            <h3 class="text-lg font-semibold">Basic Settings</h3>
            
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label htmlFor="proxy-pass">Proxy Pass URL</Label>
                <Input
                  id="proxy-pass"
                  v-model="formData.proxyPass"
                  placeholder="http://localhost:3000"
                  required
                />
                <p class="text-sm text-muted-foreground">
                  The backend server URL to proxy requests to
                </p>
              </div>

              <div class="space-y-2">
                <Label htmlFor="proxy-host">Proxy Host Header</Label>
                <Input
                  id="proxy-host"
                  v-model="formData.proxyHost"
                  placeholder="$host"
                />
                <p class="text-sm text-muted-foreground">
                  Host header to send to backend (default: $host)
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <div class="flex items-center space-x-2">
                <Checkbox
                  id="websocket"
                  v-model:checked="formData.websocketSupport"
                />
                <Label htmlFor="websocket" class="cursor-pointer">
                  Enable WebSocket Support
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <Checkbox
                  id="cache"
                  v-model:checked="formData.cacheEnabled"
                />
                <Label htmlFor="cache" class="cursor-pointer">
                  Enable Caching
                </Label>
              </div>

              <div class="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  v-model:checked="formData.isActive"
                />
                <Label htmlFor="active" class="cursor-pointer">
                  Active
                </Label>
              </div>
            </div>
          </div>

          <!-- Custom Headers -->
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold">Custom Headers</h3>
              <Button @click="addHeader" type="button" size="sm" variant="outline">
                <Plus class="w-4 h-4 mr-1" />
                Add Header
              </Button>
            </div>

            <div class="space-y-2">
              <div v-for="(header, index) in headers" :key="index" class="flex gap-2">
                <Input
                  v-model="header.key"
                  placeholder="Header Name"
                  class="flex-1"
                />
                <Input
                  v-model="header.value"
                  placeholder="Header Value"
                  class="flex-1"
                />
                <Button
                  @click="removeHeader(index)"
                  type="button"
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 class="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Custom Configuration -->
          <div class="space-y-2">
            <Label htmlFor="custom-config">Custom Nginx Configuration</Label>
            <Textarea
              id="custom-config"
              v-model="formData.customConfig"
              placeholder="# Additional nginx directives..."
              rows="8"
              class="font-mono"
            />
            <p class="text-sm text-muted-foreground">
              Add custom nginx directives that will be included in the location block
            </p>
          </div>

          <!-- Preview -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <Label>Configuration Preview</Label>
              <Button @click="copyConfig" type="button" size="sm" variant="outline">
                <Copy class="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
            <div class="bg-muted p-4 rounded-md overflow-x-auto">
              <pre class="text-sm font-mono">{{ configPreview }}</pre>
            </div>
          </div>
        </form>
      </div>

      <DialogFooter class="p-4 border-t">
        <div class="flex justify-between items-center w-full">
          <div class="flex gap-2">
            <Button
              v-if="hasExistingConfig"
              @click="deleteConfig"
              variant="destructive"
              :disabled="deleting"
            >
              {{ deleting ? 'Deleting...' : 'Delete Configuration' }}
            </Button>
          </div>
          <div class="flex gap-2">
            <Button type="button" variant="outline" @click="open = false">
              Cancel
            </Button>
            <Button @click="handleSubmit" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Configuration' }}
            </Button>
          </div>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { Plus, Trash2, Copy } from 'lucide-vue-next';
import Dialog from '@/components/ui/dialog.vue';
import DialogContent from '@/components/ui/dialog-content.vue';
import DialogHeader from '@/components/ui/dialog-header.vue';
import DialogTitle from '@/components/ui/dialog-title.vue';
import DialogDescription from '@/components/ui/dialog-description.vue';
import DialogFooter from '@/components/ui/dialog-footer.vue';
import Button from '@/components/ui/button.vue';
import Input from '@/components/ui/input.vue';
import Label from '@/components/ui/label.vue';
import Textarea from '@/components/ui/textarea.vue';
import Checkbox from '@/components/ui/checkbox.vue';
import { reverseProxyApi } from '@/api/reverse-proxy.api';
import { nginxApi } from '@/api/nginx.api';
import type { Domain } from '@/types/domain';
import type { ReverseProxyFormData } from '@/api/reverse-proxy.api';

const props = defineProps<{
  open: boolean;
  domain: Domain | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'proxy-updated': [];
}>();

const open = ref(props.open);
const saving = ref(false);
const deleting = ref(false);
const hasExistingConfig = ref(false);

const formData = ref<ReverseProxyFormData>({
  domainId: 0,
  proxyPass: '',
  proxyHost: '$host',
  websocketSupport: true,
  cacheEnabled: false,
  isActive: true,
  customConfig: ''
});

const headers = ref<Array<{ key: string; value: string }>>([]);

watch(() => props.open, (newVal) => {
  open.value = newVal;
  if (newVal && props.domain) {
    loadExistingConfig();
  }
});

watch(open, (newVal) => {
  emit('update:open', newVal);
});

const loadExistingConfig = async () => {
  if (!props.domain) return;
  
  // Reset form
  formData.value = {
    domainId: props.domain.id,
    proxyPass: '',
    proxyHost: '$host',
    websocketSupport: true,
    cacheEnabled: false,
    isActive: true,
    customConfig: ''
  };
  headers.value = [];
  hasExistingConfig.value = false;

  try {
    const config = await reverseProxyApi.getConfig(props.domain.id);
    if (config) {
      hasExistingConfig.value = true;
      formData.value = {
        domainId: config.domainId,
        proxyPass: config.proxyPass,
        proxyHost: config.proxyHost || '$host',
        websocketSupport: config.websocketSupport,
        cacheEnabled: config.cacheEnabled,
        isActive: config.isActive,
        customConfig: config.customConfig || ''
      };

      // Parse headers
      if (config.proxyHeadersParsed) {
        headers.value = Object.entries(config.proxyHeadersParsed).map(([key, value]) => ({
          key,
          value: value as string
        }));
      }
    }
  } catch (error) {
    console.error('Failed to load reverse proxy config:', error);
  }
};

const addHeader = () => {
  headers.value.push({ key: '', value: '' });
};

const removeHeader = (index: number) => {
  headers.value.splice(index, 1);
};

const configPreview = computed(() => {
  if (!props.domain) return '';
  
  const lines = ['server {'];
  lines.push(`    listen ${props.domain.port || 80};`);
  lines.push(`    listen [::]:${props.domain.port || 80};`);
  lines.push(`    server_name ${props.domain.name};`);
  lines.push('');
  lines.push('    location / {');
  lines.push(`        proxy_pass ${formData.value.proxyPass || 'http://localhost:3000'};`);
  lines.push(`        proxy_set_header Host ${formData.value.proxyHost || '$host'};`);
  lines.push('        proxy_set_header X-Real-IP $remote_addr;');
  lines.push('        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  lines.push('        proxy_set_header X-Forwarded-Proto $scheme;');
  
  // Custom headers
  headers.value.forEach(header => {
    if (header.key && header.value) {
      lines.push(`        proxy_set_header ${header.key} ${header.value};`);
    }
  });
  
  if (formData.value.websocketSupport) {
    lines.push('');
    lines.push('        # Websocket support');
    lines.push('        proxy_http_version 1.1;');
    lines.push('        proxy_set_header Upgrade $http_upgrade;');
    lines.push('        proxy_set_header Connection "upgrade";');
  }
  
  if (!formData.value.cacheEnabled) {
    lines.push('');
    lines.push('        # Disable caching');
    lines.push('        proxy_cache_bypass $http_upgrade;');
  }
  
  if (formData.value.customConfig) {
    lines.push('');
    lines.push('        # Custom configuration');
    formData.value.customConfig.split('\n').forEach(line => {
      if (line.trim()) {
        lines.push(`        ${line.trim()}`);
      }
    });
  }
  
  lines.push('    }');
  lines.push('}');
  
  return lines.join('\n');
});

const copyConfig = () => {
  navigator.clipboard.writeText(configPreview.value);
  // You could add a toast notification here
};

const handleSubmit = async () => {
  if (!props.domain || !formData.value.proxyPass) return;
  
  saving.value = true;
  
  try {
    // Convert headers array to object
    const proxyHeaders: Record<string, string> = {};
    headers.value.forEach(header => {
      if (header.key && header.value) {
        proxyHeaders[header.key] = header.value;
      }
    });
    
    const data: ReverseProxyFormData = {
      ...formData.value,
      proxyHeaders: Object.keys(proxyHeaders).length > 0 ? proxyHeaders : undefined
    };
    
    await reverseProxyApi.saveConfig(data);
    
    // Try to reload nginx
    try {
      await nginxApi.reload();
    } catch (error) {
      console.error('Failed to reload nginx:', error);
      alert('Configuration saved but failed to reload nginx. Please reload it manually.');
    }
    
    emit('proxy-updated');
    open.value = false;
  } catch (error: any) {
    console.error('Failed to save reverse proxy config:', error);
    alert(`Failed to save configuration: ${error.message}`);
  } finally {
    saving.value = false;
  }
};

const deleteConfig = async () => {
  if (!props.domain || !confirm('Are you sure you want to delete this reverse proxy configuration?')) {
    return;
  }
  
  deleting.value = true;
  
  try {
    await reverseProxyApi.deleteConfig(props.domain.id);
    
    // Try to reload nginx
    try {
      await nginxApi.reload();
    } catch (error) {
      console.error('Failed to reload nginx:', error);
    }
    
    emit('proxy-updated');
    open.value = false;
  } catch (error: any) {
    console.error('Failed to delete reverse proxy config:', error);
    alert(`Failed to delete configuration: ${error.message}`);
  } finally {
    deleting.value = false;
  }
};
</script>