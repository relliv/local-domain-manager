import { ipcMain } from 'electron';
import { DomainService } from '../../src/db/services/domain.service';
import { HostFileService } from './host-file.service';
import { PermissionHelper } from './permission-helper';
import type { DomainFormData } from '../../src/types/domain';

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
}