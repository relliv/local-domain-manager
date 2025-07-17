/**
 * Example integration between nginx parser and Local Domain Manager
 */

import { parseNginxConfigForDomains } from './nginx-parser';
import { generateNginxServerBlock, generateNginxInclude, compareDomains } from './nginx-utils';
import type { Domain } from '../src/types/domain';

/**
 * Example: Import domains from nginx config file
 */
export async function importFromNginx(nginxConfigContent: string): Promise<Domain[]> {
  // Parse nginx config and extract domains
  const nginxDomains = parseNginxConfigForDomains(nginxConfigContent);
  
  // Convert to Domain format
  const domains: Domain[] = nginxDomains.map((nginxDomain, index) => ({
    id: 0, // Will be assigned by database
    name: nginxDomain.name,
    ip_address: '127.0.0.1',
    port: nginxDomain.port,
    is_active: true,
    description: `Imported from nginx${nginxDomain.upstream ? ' (proxy to ' + nginxDomain.upstream + ')' : ''}`,
    category: nginxDomain.ssl ? 'HTTPS' : 'HTTP',
    tags: JSON.stringify([
      'nginx-import',
      nginxDomain.ssl ? 'ssl' : 'http',
      nginxDomain.upstream ? 'proxy' : 'static'
    ]),
    parent_id: undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  return domains;
}

/**
 * Example: Export domains to nginx config
 */
export function exportToNginx(domains: Domain[]): string {
  return generateNginxInclude(domains);
}

/**
 * Example: Sync check between managed domains and nginx
 */
export function syncCheck(managedDomains: Domain[], nginxConfigContent: string) {
  const nginxConfig = parseNginxConfigForDomains(nginxConfigContent);
  
  const comparison = {
    managed: managedDomains.map(d => d.name),
    nginx: nginxConfig.map(d => d.name),
    missing_in_nginx: [] as string[],
    missing_in_manager: [] as string[],
    port_mismatches: [] as Array<{ name: string; managed_port: number; nginx_port: number }>
  };
  
  // Find missing in nginx
  managedDomains.forEach(domain => {
    if (!nginxConfig.find(n => n.name === domain.name)) {
      comparison.missing_in_nginx.push(domain.name);
    }
  });
  
  // Find missing in manager
  nginxConfig.forEach(nginx => {
    const managed = managedDomains.find(d => d.name === nginx.name);
    if (!managed) {
      comparison.missing_in_manager.push(nginx.name);
    } else if ((managed.port || 80) !== nginx.port) {
      comparison.port_mismatches.push({
        name: nginx.name,
        managed_port: managed.port || 80,
        nginx_port: nginx.port
      });
    }
  });
  
  return comparison;
}

/**
 * Example usage
 */
async function example() {
  // Sample nginx config
  const nginxConfig = `
    server {
      listen 80;
      server_name app.local;
      
      location / {
        proxy_pass http://127.0.0.1:3000;
      }
    }
    
    server {
      listen 443 ssl;
      server_name secure.local;
      
      ssl_certificate /etc/ssl/certs/secure.local.crt;
      ssl_certificate_key /etc/ssl/private/secure.local.key;
      
      location / {
        proxy_pass http://127.0.0.1:4000;
      }
    }
  `;
  
  // Import domains
  console.log('=== Importing from Nginx ===');
  const imported = await importFromNginx(nginxConfig);
  console.log('Imported domains:', imported.map(d => `${d.name}:${d.port}`).join(', '));
  
  // Generate nginx config for export
  console.log('\n=== Exporting to Nginx ===');
  const exported = exportToNginx(imported);
  console.log(exported);
  
  // Sync check
  console.log('\n=== Sync Check ===');
  const syncResult = syncCheck(imported, nginxConfig);
  console.log('Missing in nginx:', syncResult.missing_in_nginx);
  console.log('Missing in manager:', syncResult.missing_in_manager);
  console.log('Port mismatches:', syncResult.port_mismatches);
}

// Run example if executed directly
if (require.main === module) {
  example().catch(console.error);
}