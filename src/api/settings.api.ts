export const settingsApi = {
  async getSetting(key: string): Promise<string | null> {
    return window.ipcRenderer.invoke('settings:get', key);
  },

  async setSetting(key: string, value: string, description?: string) {
    return window.ipcRenderer.invoke('settings:set', key, value, description);
  },

  async getAllSettings() {
    return window.ipcRenderer.invoke('settings:get-all');
  },

  async isInitialSetupComplete(): Promise<boolean> {
    return window.ipcRenderer.invoke('settings:is-initial-setup-complete');
  },

  async getNginxPath(): Promise<string | null> {
    return this.getSetting('nginx_path');
  },

  async setNginxPath(path: string) {
    return this.setSetting('nginx_path', path, 'Nginx configuration directory path');
  }
};