import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { reverseProxyConfigs } from '../schema';
import type { ReverseProxyConfig, NewReverseProxyConfig } from '../schema';

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

export class ReverseProxyService {
  /**
   * Get reverse proxy config by domain ID
   */
  static async getByDomainId(domainId: number): Promise<ReverseProxyConfig | null> {
    const db = getDb();
    const result = await db.select()
      .from(reverseProxyConfigs)
      .where(eq(reverseProxyConfigs.domainId, domainId))
      .get();
    
    if (result) {
      // Parse JSON headers if they exist
      if (result.proxyHeaders) {
        try {
          (result as any).proxyHeadersParsed = JSON.parse(result.proxyHeaders);
        } catch {
          (result as any).proxyHeadersParsed = {};
        }
      }
    }
    
    return result || null;
  }

  /**
   * Create or update reverse proxy configuration
   */
  static async saveReverseProxy(data: ReverseProxyFormData): Promise<ReverseProxyConfig> {
    const db = getDb();
    
    // Check if config exists for this domain
    const existing = await this.getByDomainId(data.domainId);
    
    const configData: any = {
      domainId: data.domainId,
      proxyPass: data.proxyPass,
      proxyHost: data.proxyHost || '$host',
      proxyHeaders: data.proxyHeaders ? JSON.stringify(data.proxyHeaders) : null,
      websocketSupport: data.websocketSupport ?? false,
      cacheEnabled: data.cacheEnabled ?? false,
      customConfig: data.customConfig || null,
      isActive: data.isActive ?? true
    };
    
    if (existing) {
      // Update existing config
      const result = await db.update(reverseProxyConfigs)
        .set(configData)
        .where(eq(reverseProxyConfigs.id, existing.id))
        .returning()
        .get();
      return result!;
    } else {
      // Create new config
      const result = await db.insert(reverseProxyConfigs)
        .values(configData)
        .returning()
        .get();
      return result;
    }
  }

  /**
   * Delete reverse proxy configuration
   */
  static async deleteByDomainId(domainId: number): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(reverseProxyConfigs)
      .where(eq(reverseProxyConfigs.domainId, domainId))
      .run();
    return result.changes > 0;
  }

  /**
   * Get all active reverse proxy configurations
   */
  static async getAllActive(): Promise<ReverseProxyConfig[]> {
    const db = getDb();
    const results = await db.select()
      .from(reverseProxyConfigs)
      .where(eq(reverseProxyConfigs.isActive, true))
      .all();
    
    // Parse JSON headers for each result
    return results.map(result => {
      if (result.proxyHeaders) {
        try {
          (result as any).proxyHeadersParsed = JSON.parse(result.proxyHeaders);
        } catch {
          (result as any).proxyHeadersParsed = {};
        }
      }
      return result;
    });
  }

  /**
   * Generate nginx location block for reverse proxy
   */
  static generateLocationBlock(config: ReverseProxyConfig): string {
    const lines: string[] = ['    location / {'];
    
    // Proxy pass
    lines.push(`        proxy_pass ${config.proxyPass};`);
    
    // Proxy headers
    lines.push(`        proxy_set_header Host ${config.proxyHost || '$host'};`);
    lines.push(`        proxy_set_header X-Real-IP $remote_addr;`);
    lines.push(`        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
    lines.push(`        proxy_set_header X-Forwarded-Proto $scheme;`);
    
    // Additional headers from config
    if (config.proxyHeaders) {
      try {
        const headers = JSON.parse(config.proxyHeaders);
        for (const [key, value] of Object.entries(headers)) {
          lines.push(`        proxy_set_header ${key} ${value};`);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    
    // Websocket support
    if (config.websocketSupport) {
      lines.push('');
      lines.push('        # Websocket support');
      lines.push('        proxy_http_version 1.1;');
      lines.push('        proxy_set_header Upgrade $http_upgrade;');
      lines.push('        proxy_set_header Connection "upgrade";');
    }
    
    // Cache settings
    if (!config.cacheEnabled) {
      lines.push('');
      lines.push('        # Disable caching');
      lines.push('        proxy_cache_bypass $http_upgrade;');
      lines.push('        proxy_no_cache 1;');
      lines.push('        proxy_cache_bypass 1;');
    }
    
    // Timeouts
    lines.push('');
    lines.push('        # Timeouts');
    lines.push('        proxy_connect_timeout 60s;');
    lines.push('        proxy_send_timeout 60s;');
    lines.push('        proxy_read_timeout 60s;');
    
    // Custom config
    if (config.customConfig) {
      lines.push('');
      lines.push('        # Custom configuration');
      config.customConfig.split('\n').forEach(line => {
        if (line.trim()) {
          lines.push(`        ${line.trim()}`);
        }
      });
    }
    
    lines.push('    }');
    
    return lines.join('\n');
  }
}