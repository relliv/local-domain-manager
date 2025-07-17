declare global {
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      on(channel: string, listener: (event: any, ...args: any[]) => void): void;
      once(channel: string, listener: (event: any, ...args: any[]) => void): void;
      removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void;
      removeAllListeners(channel: string): void;
    };
    versions?: {
      node?: string;
      chrome?: string;
      electron?: string;
    };
  }
}

export {};