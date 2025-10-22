import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { DomainService } from '../../src/db/services/domain.service';
import { HostFileService } from './host-file.service';
import { PermissionHelper } from './permission-helper';
import { SettingsService } from '../../src/db/services/settings.service';
import { ReverseProxyService } from '../../src/db/services/reverse-proxy.service';
import { NginxHelper } from './nginx-helper';
import { NginxConfigService } from './nginx-config.service';
import type { DomainFormData } from '../../src/types/domain';
import type { ReverseProxyFormData } from '../../src/db/services/reverse-proxy.service';

export function setupIpcHandlers() {
  // Get all domains
  ipcMain.handle('domain:get-all', async () => {
    try {
      const domains = await DomainService.getAllDomains();
      // Ensure all domains are serializable
      return JSON.parse(JSON.stringify(domains));
    } catch (error: any) {
      console.error('Error getting domains:', error);
      throw new Error(error.message || 'Failed to get domains');
    }
  });

  // Get domain by ID
  ipcMain.handle('domain:get-by-id', async (_, id: number) => {
    try {
      const domain = await DomainService.getDomainById(id);
      return domain ? JSON.parse(JSON.stringify(domain)) : undefined;
    } catch (error: any) {
      console.error('Error getting domain:', error);
      throw new Error(error.message || 'Failed to get domain');
    }
  });

  // Create domain
  ipcMain.handle('domain:create', async (_, data: DomainFormData) => {
    try {
      const result = await DomainService.createDomain(data);
      // Ensure the result is serializable
      return JSON.parse(JSON.stringify(result));
    } catch (error: any) {
      console.error('Error creating domain:', error);
      
      // Throw a serializable error
      throw new Error(error.message || 'Failed to create domain');
    }
  });

  // Update domain
  ipcMain.handle('domain:update', async (_, id: number, data: Partial<DomainFormData>) => {
    try {
      const result = await DomainService.updateDomain(id, data);
      return result ? JSON.parse(JSON.stringify(result)) : undefined;
    } catch (error: any) {
      console.error('Error updating domain:', error);
      throw new Error(error.message || 'Failed to update domain');
    }
  });

  // Delete domain
  ipcMain.handle('domain:delete', async (_, id: number) => {
    try {
      return await DomainService.deleteDomain(id);
    } catch (error) {
      console.error('Error deleting domain:', error);
      throw error;
    }
  });

  // Toggle domain status
  ipcMain.handle('domain:toggle-status', async (_, id: number) => {
    try {
      const result = await DomainService.toggleDomainStatus(id);
      return result ? JSON.parse(JSON.stringify(result)) : undefined;
    } catch (error: any) {
      console.error('Error toggling domain status:', error);
      throw new Error(error.message || 'Failed to toggle domain status');
    }
  });

  // Check host file entry
  ipcMain.handle('host:check-exists', async (_, hostname: string) => {
    try {
      return await HostFileService.checkHostExists(hostname);
    } catch (error) {
      console.error('Error checking host:', error);
      return false;
    }
  });

  // Get all host entries
  ipcMain.handle('host:get-all', async () => {
    try {
      return await HostFileService.parseHostFile();
    } catch (error) {
      console.error('Error reading host file:', error);
      return [];
    }
  });

  // Sync database with host file
  ipcMain.handle('host:sync', async () => {
    try {
      const domains = await DomainService.getAllDomains();
      const hostEntries = await HostFileService.parseHostFile();
      
      // Add active domains to host file if missing
      for (const domain of domains) {
        if (domain.is_active) {
          const exists = hostEntries.some(entry => entry.hostname === domain.name);
          if (!exists) {
            await HostFileService.addHostEntry(domain.ip_address, domain.name, domain.description || undefined);
          }
        }
      }
      
      await HostFileService.flushDNSCache();
      return { success: true };
    } catch (error) {
      console.error('Error syncing host file:', error);
      throw error;
    }
  });

  // Get domains as tree structure
  ipcMain.handle('domain:get-tree', async () => {
    try {
      const tree = await DomainService.getDomainsTree();
      return JSON.parse(JSON.stringify(tree));
    } catch (error: any) {
      console.error('Error getting domains tree:', error);
      throw new Error(error.message || 'Failed to get domains tree');
    }
  });

  // Get root domains only
  ipcMain.handle('domain:get-roots', async () => {
    try {
      const roots = await DomainService.getRootDomains();
      return JSON.parse(JSON.stringify(roots));
    } catch (error: any) {
      console.error('Error getting root domains:', error);
      throw new Error(error.message || 'Failed to get root domains');
    }
  });

  // Get subdomains of a parent
  ipcMain.handle('domain:get-subdomains', async (_, parentId: number) => {
    try {
      const subdomains = await DomainService.getSubdomains(parentId);
      return JSON.parse(JSON.stringify(subdomains));
    } catch (error: any) {
      console.error('Error getting subdomains:', error);
      throw new Error(error.message || 'Failed to get subdomains');
    }
  });

  // Settings handlers
  ipcMain.handle('settings:get', async (_, key: string) => {
    try {
      return await SettingsService.getSetting(key);
    } catch (error: any) {
      console.error('Error getting setting:', error);
      throw new Error(error.message || 'Failed to get setting');
    }
  });

  ipcMain.handle('settings:set', async (_, key: string, value: string, description?: string) => {
    try {
      const result = await SettingsService.setSetting(key, value, description);
      return JSON.parse(JSON.stringify(result));
    } catch (error: any) {
      console.error('Error setting value:', error);
      throw new Error(error.message || 'Failed to set setting');
    }
  });

  ipcMain.handle('settings:get-all', async () => {
    try {
      const settings = await SettingsService.getAllSettings();
      return JSON.parse(JSON.stringify(settings));
    } catch (error: any) {
      console.error('Error getting settings:', error);
      throw new Error(error.message || 'Failed to get settings');
    }
  });

  ipcMain.handle('settings:is-initial-setup-complete', async () => {
    try {
      return await SettingsService.isInitialSetupComplete();
    } catch (error: any) {
      console.error('Error checking setup status:', error);
      throw new Error(error.message || 'Failed to check setup status');
    }
  });

  // Nginx handlers
  ipcMain.handle('nginx:detect-path', async () => {
    try {
      return await NginxHelper.detectNginxPath();
    } catch (error: any) {
      console.error('Error detecting nginx path:', error);
      throw new Error(error.message || 'Failed to detect nginx path');
    }
  });

  ipcMain.handle('nginx:is-installed', async () => {
    try {
      return await NginxHelper.isNginxInstalled();
    } catch (error: any) {
      console.error('Error checking nginx installation:', error);
      throw new Error(error.message || 'Failed to check nginx installation');
    }
  });

  ipcMain.handle('nginx:test-config', async () => {
    try {
      return await NginxHelper.testNginxConfig();
    } catch (error: any) {
      console.error('Error testing nginx config:', error);
      throw new Error(error.message || 'Failed to test nginx config');
    }
  });

  ipcMain.handle('nginx:reload', async () => {
    try {
      await NginxHelper.reloadNginx();
      return { success: true };
    } catch (error: any) {
      console.error('Error reloading nginx:', error);
      throw new Error(error.message || 'Failed to reload nginx');
    }
  });

  ipcMain.handle('nginx:sync-all', async () => {
    try {
      return await NginxConfigService.syncAllDomains();
    } catch (error: any) {
      console.error('Error syncing nginx configs:', error);
      throw new Error(error.message || 'Failed to sync nginx configs');
    }
  });

  // Reverse proxy handlers
  ipcMain.handle('reverse-proxy:get', async (_, domainId: number) => {
    try {
      const config = await ReverseProxyService.getByDomainId(domainId);
      return config ? JSON.parse(JSON.stringify(config)) : null;
    } catch (error: any) {
      console.error('Error getting reverse proxy config:', error);
      throw new Error(error.message || 'Failed to get reverse proxy config');
    }
  });

  ipcMain.handle('reverse-proxy:save', async (_, data: ReverseProxyFormData) => {
    try {
      const result = await ReverseProxyService.saveReverseProxy(data);
      
      // Update nginx config if domain is active
      const domain = await DomainService.getDomainById(data.domainId);
      if (domain && domain.is_active && !domain.parent_id) {
        await NginxConfigService.createOrUpdateDomainConfig(domain);
      }
      
      return JSON.parse(JSON.stringify(result));
    } catch (error: any) {
      console.error('Error saving reverse proxy config:', error);
      throw new Error(error.message || 'Failed to save reverse proxy config');
    }
  });

  ipcMain.handle('reverse-proxy:delete', async (_, domainId: number) => {
    try {
      const success = await ReverseProxyService.deleteByDomainId(domainId);
      
      // Update nginx config if domain is active
      const domain = await DomainService.getDomainById(domainId);
      if (domain && domain.is_active && !domain.parent_id) {
        await NginxConfigService.createOrUpdateDomainConfig(domain);
      }
      
      return success;
    } catch (error: any) {
      console.error('Error deleting reverse proxy config:', error);
      throw new Error(error.message || 'Failed to delete reverse proxy config');
    }
  });

  // Show folder picker dialog
  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Nginx Configuration Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Get platform information
  ipcMain.handle('system:get-platform', () => {
    return process.platform;
  });

  // Open URL in default browser
  ipcMain.handle('open-url', async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error('Error opening URL:', error);
      throw new Error(error.message || 'Failed to open URL');
    }
  });

  // Open folder in file explorer
  ipcMain.handle('shell:open-path', async (_, folderPath: string) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error: any) {
      console.error('Error opening folder:', error);
      throw new Error(error.message || 'Failed to open folder');
    }
  });
}