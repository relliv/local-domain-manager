export const systemApi = {
  async getPlatform(): Promise<string> {
    return window.ipcRenderer.invoke('system:get-platform');
  }
};