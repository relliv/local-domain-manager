import type { Domain, DomainFormData } from '@/types/domain';

// Serialize data to ensure it's IPC-safe (removes non-serializable objects)
const serializeData = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

export const domainApi = {
  async getAllDomains(): Promise<Domain[]> {
    return window.ipcRenderer.invoke('domain:get-all');
  },

  async getDomainById(id: number): Promise<Domain | undefined> {
    return window.ipcRenderer.invoke('domain:get-by-id', id);
  },

  async createDomain(data: DomainFormData): Promise<Domain> {
    return window.ipcRenderer.invoke('domain:create', serializeData(data));
  },

  async updateDomain(id: number, data: Partial<DomainFormData>): Promise<Domain | undefined> {
    return window.ipcRenderer.invoke('domain:update', id, serializeData(data));
  },

  async deleteDomain(id: number): Promise<boolean> {
    return window.ipcRenderer.invoke('domain:delete', id);
  },

  async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    return window.ipcRenderer.invoke('domain:toggle-status', id);
  },

  async checkHostExists(hostname: string): Promise<boolean> {
    return window.ipcRenderer.invoke('host:check-exists', hostname);
  },

  async getAllHostEntries(): Promise<any[]> {
    return window.ipcRenderer.invoke('host:get-all');
  },

  async syncHostFile(): Promise<{ success: boolean }> {
    return window.ipcRenderer.invoke('host:sync');
  },

  async getDomainsTree(): Promise<Domain[]> {
    return window.ipcRenderer.invoke('domain:get-tree');
  },

  async getRootDomains(): Promise<Domain[]> {
    return window.ipcRenderer.invoke('domain:get-roots');
  },

  async getSubdomains(parentId: number): Promise<Domain[]> {
    return window.ipcRenderer.invoke('domain:get-subdomains', parentId);
  }
};