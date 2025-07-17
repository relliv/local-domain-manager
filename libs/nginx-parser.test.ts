import { parseNginxConfig, extractDomainsFromNginx, parseNginxConfigForDomains } from './nginx-parser';

// Example nginx configuration
const exampleNginxConfig = `
# Global settings
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    # Upstream definitions
    upstream backend_servers {
        server 127.0.0.1:3000;
        server 127.0.0.1:3001;
        server 127.0.0.1:3002;
    }

    upstream api_servers {
        server 127.0.0.1:4000 weight=3;
        server 127.0.0.1:4001 weight=2;
    }

    # Server blocks
    server {
        listen 80;
        listen [::]:80;
        server_name example.local www.example.local;
        root /var/www/example;

        location / {
            try_files $uri $uri/ =404;
        }

        location /api {
            proxy_pass http://api_servers;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        server_name secure.local;
        
        ssl_certificate /etc/ssl/certs/secure.local.crt;
        ssl_certificate_key /etc/ssl/private/secure.local.key;

        root /var/www/secure;

        location / {
            proxy_pass http://backend_servers;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
        }
    }

    server {
        listen 8080;
        server_name api.local;

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_buffering off;
        }
    }

    # Subdomain example
    server {
        listen 80;
        server_name *.app.local;
        
        location / {
            proxy_pass http://127.0.0.1:5000;
        }
    }
}
`;

// Test the parser
export function testNginxParser() {
  console.log('=== Testing Nginx Parser ===\n');

  // Parse the configuration
  const config = parseNginxConfig(exampleNginxConfig);
  
  console.log('Found servers:', config.servers.length);
  console.log('Found upstreams:', config.upstreams.length);
  console.log('\n=== Server Blocks ===');
  
  config.servers.forEach((server, index) => {
    console.log(`\nServer ${index + 1}:`);
    console.log('  Server names:', server.serverName.join(', '));
    console.log('  Listen:', server.listen.join(', '));
    console.log('  Root:', server.root || 'Not specified');
    console.log('  SSL:', server.sslCertificate ? 'Yes' : 'No');
    console.log('  Locations:', server.locations.length);
  });

  console.log('\n=== Upstream Blocks ===');
  config.upstreams.forEach(upstream => {
    console.log(`\nUpstream: ${upstream.name}`);
    console.log('  Servers:', upstream.servers.join(', '));
  });

  // Extract domains
  console.log('\n=== Extracted Domains ===');
  const domains = extractDomainsFromNginx(config);
  domains.forEach(domain => {
    console.log(`\nDomain: ${domain.name}`);
    console.log('  Port:', domain.port);
    console.log('  SSL:', domain.ssl);
    console.log('  Upstream:', domain.upstream || 'None');
    console.log('  Root:', domain.root || 'Not specified');
  });

  // Direct extraction
  console.log('\n=== Direct Domain Extraction ===');
  const directDomains = parseNginxConfigForDomains(exampleNginxConfig);
  console.log('Domains found:', directDomains.map(d => d.name).join(', '));
}

// Run test if this file is executed directly
if (require.main === module) {
  testNginxParser();
}