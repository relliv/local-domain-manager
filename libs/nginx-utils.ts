/**
 * Nginx utility functions for integration with Local Domain Manager
 */

import { NginxServerBlock, NginxConfig } from './nginx-parser';
import type { Domain } from '../src/types/domain';

/**
 * Generate nginx server block from domain
 */
export function generateNginxServerBlock(domain: Domain, options?: {
  proxyPort?: number;
  enableSSL?: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  documentRoot?: string;
}): string {
  const lines: string[] = ['server {'];
  
  // Listen directives
  if (options?.enableSSL) {
    lines.push(`    listen 443 ssl;`);
    lines.push(`    listen [::]:443 ssl;`);
  } else {
    lines.push(`    listen ${domain.port || 80};`);
    lines.push(`    listen [::]:${domain.port || 80};`);
  }
  
  // Server name
  lines.push(`    server_name ${domain.name};`);
  
  // SSL configuration
  if (options?.enableSSL && options.sslCertPath && options.sslKeyPath) {
    lines.push('');
    lines.push(`    ssl_certificate ${options.sslCertPath};`);
    lines.push(`    ssl_certificate_key ${options.sslKeyPath};`);
    lines.push(`    ssl_protocols TLSv1.2 TLSv1.3;`);
    lines.push(`    ssl_ciphers HIGH:!aNULL:!MD5;`);
  }
  
  // Root or proxy configuration
  lines.push('');
  if (options?.proxyPort) {
    lines.push(`    location / {`);
    lines.push(`        proxy_pass http://127.0.0.1:${options.proxyPort};`);
    lines.push(`        proxy_http_version 1.1;`);
    lines.push(`        proxy_set_header Upgrade $http_upgrade;`);
    lines.push(`        proxy_set_header Connection 'upgrade';`);
    lines.push(`        proxy_set_header Host $host;`);
    lines.push(`        proxy_cache_bypass $http_upgrade;`);
    lines.push(`    }`);
  } else if (options?.documentRoot) {
    lines.push(`    root ${options.documentRoot};`);
    lines.push(`    index index.html index.htm;`);
    lines.push('');
    lines.push(`    location / {`);
    lines.push(`        try_files $uri $uri/ =404;`);
    lines.push(`    }`);
  } else {
    // Default to simple proxy on port 3000
    lines.push(`    location / {`);
    lines.push(`        proxy_pass http://127.0.0.1:3000;`);
    lines.push(`        proxy_set_header Host $host;`);
    lines.push(`        proxy_set_header X-Real-IP $remote_addr;`);
    lines.push(`    }`);
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate complete nginx configuration from domains
 */
export function generateNginxConfig(domains: Domain[], options?: {
  includeUpstreams?: boolean;
  defaultProxyPort?: number;
}): string {
  const lines: string[] = [];
  
  // HTTP block
  lines.push('http {');
  lines.push('    # Basic Settings');
  lines.push('    sendfile on;');
  lines.push('    tcp_nopush on;');
  lines.push('    tcp_nodelay on;');
  lines.push('    keepalive_timeout 65;');
  lines.push('    types_hash_max_size 2048;');
  lines.push('');
  
  // Include mime types
  lines.push('    include /etc/nginx/mime.types;');
  lines.push('    default_type application/octet-stream;');
  lines.push('');
  
  // Logging
  lines.push('    # Logging Settings');
  lines.push('    access_log /var/log/nginx/access.log;');
  lines.push('    error_log /var/log/nginx/error.log;');
  lines.push('');
  
  // Gzip
  lines.push('    # Gzip Settings');
  lines.push('    gzip on;');
  lines.push('    gzip_vary on;');
  lines.push('    gzip_proxied any;');
  lines.push('    gzip_comp_level 6;');
  lines.push('    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;');
  lines.push('');
  
  // Generate server blocks for each domain
  const activeDomains = domains.filter(d => d.is_active);
  
  // Group domains by parent for potential upstream generation
  const rootDomains = activeDomains.filter(d => !d.parent_id);
  const subdomains = activeDomains.filter(d => d.parent_id);
  
  // Generate upstreams if requested
  if (options?.includeUpstreams) {
    const upstreamGroups = new Map<string, Domain[]>();
    
    // Group subdomains by parent
    subdomains.forEach(subdomain => {
      const parent = rootDomains.find(d => d.id === subdomain.parent_id);
      if (parent) {
        if (!upstreamGroups.has(parent.name)) {
          upstreamGroups.set(parent.name, []);
        }
        upstreamGroups.get(parent.name)!.push(subdomain);
      }
    });
    
    // Generate upstream blocks
    upstreamGroups.forEach((subs, parentName) => {
      lines.push(`    upstream ${parentName.replace(/\./g, '_')}_backend {`);
      subs.forEach(sub => {
        lines.push(`        server 127.0.0.1:${sub.port || options.defaultProxyPort || 3000};`);
      });
      lines.push('    }');
      lines.push('');
    });
  }
  
  // Generate server blocks
  activeDomains.forEach(domain => {
    lines.push('    ' + generateNginxServerBlock(domain, {
      proxyPort: domain.port || options?.defaultProxyPort
    }).split('\n').join('\n    '));
    lines.push('');
  });
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Compare domains with nginx configuration
 */
export function compareDomains(
  managedDomains: Domain[],
  nginxServers: NginxServerBlock[]
): {
  inBoth: Array<{ domain: Domain; server: NginxServerBlock }>;
  onlyInManager: Domain[];
  onlyInNginx: NginxServerBlock[];
} {
  const result = {
    inBoth: [] as Array<{ domain: Domain; server: NginxServerBlock }>,
    onlyInManager: [...managedDomains],
    onlyInNginx: [...nginxServers]
  };
  
  // Find matches
  managedDomains.forEach(domain => {
    const serverIndex = nginxServers.findIndex(server => 
      server.serverName.includes(domain.name)
    );
    
    if (serverIndex !== -1) {
      result.inBoth.push({
        domain,
        server: nginxServers[serverIndex]
      });
      
      // Remove from "only" lists
      result.onlyInManager = result.onlyInManager.filter(d => d.id !== domain.id);
      result.onlyInNginx.splice(serverIndex, 1);
    }
  });
  
  return result;
}

/**
 * Validate nginx server name
 */
export function isValidNginxServerName(name: string): boolean {
  // Check for valid characters
  if (!/^[a-zA-Z0-9.-]+$/.test(name)) {
    return false;
  }
  
  // Check for valid format
  const parts = name.split('.');
  if (parts.length < 2) {
    return false; // Must have at least one dot
  }
  
  // Check each part
  for (const part of parts) {
    if (part.length === 0 || part.length > 63) {
      return false;
    }
    if (part.startsWith('-') || part.endsWith('-')) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate nginx include file for managed domains
 */
export function generateNginxInclude(domains: Domain[]): string {
  const activeDomains = domains.filter(d => d.is_active);
  const lines: string[] = [
    '# Generated by Local Domain Manager',
    `# Date: ${new Date().toISOString()}`,
    `# Domains: ${activeDomains.length}`,
    '',
    '# Include this file in your nginx.conf:',
    '# include /path/to/local-domains.conf;',
    ''
  ];
  
  activeDomains.forEach(domain => {
    lines.push(`# Domain: ${domain.name}`);
    if (domain.description) {
      lines.push(`# Description: ${domain.description}`);
    }
    lines.push(generateNginxServerBlock(domain));
    lines.push('');
  });
  
  return lines.join('\n');
}