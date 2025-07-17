export interface ReverseProxyFormData {
  domainId: number;
  proxyPass: string;
  proxyHost?: string;
  proxyHeaders?: Record<string, string>;
  websocketSupport?: boolean;
  cacheEnabled?: boolean;
  customConfig?: string;
  isActive?: boolean;
}

export interface ReverseProxyConfig {
  id: number;
  domainId: number;
  proxyPass: string;
  proxyHost?: string;
  proxyHeaders?: string;
  proxyHeadersParsed?: Record<string, string>;
  websocketSupport: boolean;
  cacheEnabled: boolean;
  customConfig?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const reverseProxyApi = {
  async getConfig(domainId: number): Promise<ReverseProxyConfig | null> {
    return window.ipcRenderer.invoke('reverse-proxy:get', domainId);
  },

  async saveConfig(data: ReverseProxyFormData): Promise<ReverseProxyConfig> {
    return window.ipcRenderer.invoke('reverse-proxy:save', data);
  },

  async deleteConfig(domainId: number): Promise<boolean> {
    return window.ipcRenderer.invoke('reverse-proxy:delete', domainId);
  }
};