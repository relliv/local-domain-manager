import { ipcMain } from 'electron';
import { DomainService } from '../../src/db/services/domain.service';
import { HostFileService } from './host-file.service';
import { PermissionHelper } from './permission-helper';
import type { DomainFormData } from '../../src/types/domain';

export function setupIpcHandlers() {
  // Get all domains
  ipcMain.handle('domain:get-all', async () => {
    try {
      return await DomainService.getAllDomains();
    } catch (error) {
      console.error('Error getting domains:', error);
      throw error;
    }
  });

  // Get domain by ID
  ipcMain.handle('domain:get-by-id', async (_, id: number) => {
    try {
      return await DomainService.getDomainById(id);
    } catch (error) {
      console.error('Error getting domain:', error);
      throw error;
    }
  });

  // Create domain
  ipcMain.handle('domain:create', async (_, data: DomainFormData) => {
    try {
      // If domain is active, check permissions first
      if (data.is_active) {
        const hasPermission = await PermissionHelper.requestHostFilePermission();
        if (!hasPermission) {
          throw new Error('Permission denied to modify host file');
        }
      }
      
      return await DomainService.createDomain(data);
    } catch (error: any) {
      console.error('Error creating domain:', error);
      
      // Show permission error dialog if it's a permission issue
      if (error.message.includes('Permission denied') || error.message.includes('EACCES')) {
        await PermissionHelper.showPermissionError();
      }
      
      throw error;
    }
  });

  // Update domain
  ipcMain.handle('domain:update', async (_, id: number, data: Partial<DomainFormData>) => {
    try {
      return await DomainService.updateDomain(id, data);
    } catch (error) {
      console.error('Error updating domain:', error);
      throw error;
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
      return await DomainService.toggleDomainStatus(id);
    } catch (error) {
      console.error('Error toggling domain status:', error);
      throw error;
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
}