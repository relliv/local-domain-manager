import { ipcMain } from 'electron';
import { DomainService } from '../../src/db/services/domain.service';
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
      return await DomainService.createDomain(data);
    } catch (error) {
      console.error('Error creating domain:', error);
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
}