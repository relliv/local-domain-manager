/**
 * Nginx Configuration File Parser
 * Parses nginx configuration files and extracts domain/server configurations
 */

export interface NginxLocation {
  path: string;
  directives: NginxDirective[];
}

export interface NginxDirective {
  name: string;
  value: string | string[];
  block?: NginxDirective[];
}

export interface NginxServerBlock {
  serverName: string[];
  listen: string[];
  root?: string;
  locations: NginxLocation[];
  sslCertificate?: string;
  sslCertificateKey?: string;
  directives: NginxDirective[];
}

export interface NginxUpstream {
  name: string;
  servers: string[];
  directives: NginxDirective[];
}

export interface NginxConfig {
  servers: NginxServerBlock[];
  upstreams: NginxUpstream[];
  http?: NginxDirective[];
  events?: NginxDirective[];
  main?: NginxDirective[];
}

export class NginxParser {
  private content: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(content: string) {
    this.content = content;
  }

  /**
   * Parse nginx configuration content
   */
  parse(): NginxConfig {
    const config: NginxConfig = {
      servers: [],
      upstreams: [],
      http: [],
      events: [],
      main: []
    };

    while (this.position < this.content.length) {
      this.skipWhitespaceAndComments();
      if (this.position >= this.content.length) break;

      const directive = this.parseDirective();
      if (!directive) continue;

      // Handle top-level blocks
      if (directive.name === 'http' && directive.block) {
        config.http = directive.block;
        this.parseHttpBlock(directive.block, config);
      } else if (directive.name === 'events' && directive.block) {
        config.events = directive.block;
      } else if (directive.name === 'server' && directive.block) {
        const server = this.parseServerBlock(directive.block);
        if (server) config.servers.push(server);
      } else if (directive.name === 'upstream' && directive.block) {
        const upstream = this.parseUpstreamBlock(directive.value as string, directive.block);
        if (upstream) config.upstreams.push(upstream);
      } else {
        config.main?.push(directive);
      }
    }

    return config;
  }

  /**
   * Parse HTTP block directives
   */
  private parseHttpBlock(directives: NginxDirective[], config: NginxConfig): void {
    for (const directive of directives) {
      if (directive.name === 'server' && directive.block) {
        const server = this.parseServerBlock(directive.block);
        if (server) config.servers.push(server);
      } else if (directive.name === 'upstream' && directive.block) {
        const upstream = this.parseUpstreamBlock(directive.value as string, directive.block);
        if (upstream) config.upstreams.push(upstream);
      }
    }
  }

  /**
   * Parse server block
   */
  private parseServerBlock(directives: NginxDirective[]): NginxServerBlock | null {
    const server: NginxServerBlock = {
      serverName: [],
      listen: [],
      locations: [],
      directives: []
    };

    for (const directive of directives) {
      switch (directive.name) {
        case 'server_name':
          server.serverName = Array.isArray(directive.value) 
            ? directive.value 
            : directive.value.split(/\s+/);
          break;
        case 'listen':
          server.listen.push(directive.value as string);
          break;
        case 'root':
          server.root = directive.value as string;
          break;
        case 'ssl_certificate':
          server.sslCertificate = directive.value as string;
          break;
        case 'ssl_certificate_key':
          server.sslCertificateKey = directive.value as string;
          break;
        case 'location':
          if (directive.block) {
            server.locations.push({
              path: directive.value as string,
              directives: directive.block
            });
          }
          break;
        default:
          server.directives.push(directive);
      }
    }

    return server.serverName.length > 0 ? server : null;
  }

  /**
   * Parse upstream block
   */
  private parseUpstreamBlock(name: string, directives: NginxDirective[]): NginxUpstream | null {
    const upstream: NginxUpstream = {
      name,
      servers: [],
      directives: []
    };

    for (const directive of directives) {
      if (directive.name === 'server') {
        upstream.servers.push(directive.value as string);
      } else {
        upstream.directives.push(directive);
      }
    }

    return upstream.servers.length > 0 ? upstream : null;
  }

  /**
   * Parse a single directive
   */
  private parseDirective(): NginxDirective | null {
    this.skipWhitespaceAndComments();
    
    const name = this.parseWord();
    if (!name) return null;

    this.skipWhitespace();

    // Check if this is a block directive
    if (this.peek() === '{') {
      this.advance(); // skip '{'
      const block = this.parseBlock();
      return { name, value: '', block };
    }

    // Parse directive value(s)
    const values: string[] = [];
    while (this.position < this.content.length && 
           this.peek() !== ';' && 
           this.peek() !== '{' && 
           this.peek() !== '}') {
      const value = this.parseValue();
      if (value) values.push(value);
      this.skipWhitespace();
    }

    // Skip semicolon if present
    if (this.peek() === ';') {
      this.advance();
    }

    return {
      name,
      value: values.length === 1 ? values[0] : values
    };
  }

  /**
   * Parse a block of directives
   */
  private parseBlock(): NginxDirective[] {
    const directives: NginxDirective[] = [];

    while (this.position < this.content.length) {
      this.skipWhitespaceAndComments();
      
      if (this.peek() === '}') {
        this.advance(); // skip '}'
        break;
      }

      const directive = this.parseDirective();
      if (directive) {
        directives.push(directive);
      }
    }

    return directives;
  }

  /**
   * Parse a word (directive name or unquoted value)
   */
  private parseWord(): string {
    let word = '';
    
    while (this.position < this.content.length) {
      const char = this.peek();
      if (/[\s;{}#]/.test(char)) break;
      word += char;
      this.advance();
    }

    return word;
  }

  /**
   * Parse a value (quoted or unquoted)
   */
  private parseValue(): string {
    this.skipWhitespace();

    const char = this.peek();
    if (char === '"' || char === "'") {
      return this.parseQuotedString(char);
    }

    return this.parseWord();
  }

  /**
   * Parse a quoted string
   */
  private parseQuotedString(quote: string): string {
    this.advance(); // skip opening quote
    let value = '';
    let escaped = false;

    while (this.position < this.content.length) {
      const char = this.peek();
      
      if (escaped) {
        value += char;
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        this.advance(); // skip closing quote
        break;
      } else {
        value += char;
      }
      
      this.advance();
    }

    return value;
  }

  /**
   * Skip whitespace and comments
   */
  private skipWhitespaceAndComments(): void {
    while (this.position < this.content.length) {
      this.skipWhitespace();
      
      if (this.peek() === '#') {
        this.skipComment();
      } else {
        break;
      }
    }
  }

  /**
   * Skip whitespace
   */
  private skipWhitespace(): void {
    while (this.position < this.content.length && /\s/.test(this.peek())) {
      this.advance();
    }
  }

  /**
   * Skip comment to end of line
   */
  private skipComment(): void {
    while (this.position < this.content.length && this.peek() !== '\n') {
      this.advance();
    }
  }

  /**
   * Peek at current character
   */
  private peek(): string {
    return this.content[this.position] || '';
  }

  /**
   * Advance position and update line/column
   */
  private advance(): void {
    if (this.content[this.position] === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.position++;
  }
}

/**
 * Extract domain information from nginx configuration
 */
export function extractDomainsFromNginx(config: NginxConfig): Array<{
  name: string;
  port: number;
  ssl: boolean;
  upstream?: string;
  root?: string;
}> {
  const domains: Array<{
    name: string;
    port: number;
    ssl: boolean;
    upstream?: string;
    root?: string;
  }> = [];

  for (const server of config.servers) {
    for (const serverName of server.serverName) {
      // Skip wildcard and default server names
      if (serverName === '_' || serverName.includes('*')) continue;

      // Determine port and SSL from listen directives
      let port = 80;
      let ssl = false;

      for (const listen of server.listen) {
        if (listen.includes('443') || listen.includes('ssl')) {
          port = 443;
          ssl = true;
        } else if (listen.includes(':')) {
          const match = listen.match(/:(\d+)/);
          if (match) port = parseInt(match[1]);
        }
      }

      // Find upstream from proxy_pass directives
      let upstream: string | undefined;
      for (const location of server.locations) {
        const proxyPass = location.directives.find(d => d.name === 'proxy_pass');
        if (proxyPass && typeof proxyPass.value === 'string') {
          const match = proxyPass.value.match(/http:\/\/([^\/]+)/);
          if (match) upstream = match[1];
        }
      }

      domains.push({
        name: serverName,
        port,
        ssl,
        upstream,
        root: server.root
      });
    }
  }

  return domains;
}

/**
 * Parse nginx configuration file
 */
export function parseNginxConfig(content: string): NginxConfig {
  const parser = new NginxParser(content);
  return parser.parse();
}

/**
 * Parse nginx configuration and extract domains
 */
export function parseNginxConfigForDomains(content: string) {
  const config = parseNginxConfig(content);
  return extractDomainsFromNginx(config);
}