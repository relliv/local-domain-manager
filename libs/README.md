# Local Domain Manager Libraries

This directory contains utility libraries for the Local Domain Manager application.

## Nginx Parser

A TypeScript library for parsing nginx configuration files and extracting domain information.

### Features

- Parse nginx configuration files into structured objects
- Extract server blocks with domain names, ports, and SSL settings
- Parse upstream definitions
- Extract location blocks and directives
- Support for quoted strings and comments
- Handle nested blocks and directives

### Usage

```typescript
import { parseNginxConfig, extractDomainsFromNginx, parseNginxConfigForDomains } from './nginx-parser';

// Parse nginx configuration
const config = parseNginxConfig(nginxConfigString);

// Extract domain information
const domains = extractDomainsFromNginx(config);

// Or parse and extract in one step
const domains = parseNginxConfigForDomains(nginxConfigString);
```

### Data Structures

#### NginxConfig
- `servers`: Array of server blocks
- `upstreams`: Array of upstream definitions
- `http`: HTTP block directives
- `events`: Events block directives
- `main`: Main context directives

#### NginxServerBlock
- `serverName`: Array of domain names
- `listen`: Array of listen directives
- `root`: Document root path
- `locations`: Array of location blocks
- `sslCertificate`: SSL certificate path
- `sslCertificateKey`: SSL key path
- `directives`: Other server directives

#### Extracted Domain
- `name`: Domain name
- `port`: Port number (80 or 443 typically)
- `ssl`: Boolean indicating SSL support
- `upstream`: Upstream server if using proxy_pass
- `root`: Document root path

### Testing

Run the test file to see the parser in action:

```bash
npx ts-node libs/nginx-parser.test.ts
```

### Integration Points

This parser can be integrated into the Local Domain Manager app to:

1. **Import domains from nginx config files**
   - Parse existing nginx configurations
   - Extract domain names and settings
   - Bulk import into the domain manager

2. **Sync with nginx**
   - Compare managed domains with nginx config
   - Identify missing or outdated entries
   - Generate nginx server blocks for managed domains

3. **Export to nginx**
   - Generate nginx configuration from managed domains
   - Create server blocks with proper settings
   - Support for upstream and proxy configurations

4. **Validate configurations**
   - Check for syntax errors
   - Validate domain settings
   - Ensure consistency between hosts file and nginx