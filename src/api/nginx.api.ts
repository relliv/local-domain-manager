export const nginxApi = {
  async detectPath(): Promise<string | null> {
    return window.ipcRenderer.invoke('nginx:detect-path');
  },

  async isInstalled(): Promise<boolean> {
    return window.ipcRenderer.invoke('nginx:is-installed');
  },

  async testConfig(): Promise<{ valid: boolean; error?: string }> {
    return window.ipcRenderer.invoke('nginx:test-config');
  },

  async reload(): Promise<{ success: boolean }> {
    return window.ipcRenderer.invoke('nginx:reload');
  },

  async syncAll() {
    return window.ipcRenderer.invoke('nginx:sync-all');
  },

  async selectFolder(): Promise<string | null> {
    return window.ipcRenderer.invoke('dialog:select-folder');
  },

  async openFolder(folderPath: string): Promise<void> {
    return window.ipcRenderer.invoke('shell:open-path', folderPath);
  }
};