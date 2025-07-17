import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as sudo from '@vscode/sudo-prompt';
import isElevated from 'native-is-elevated';

const execAsync = promisify(exec);

export class NginxHelper {
  private static readonly appName = 'Local Domain Manager';

  /**
   * Detect nginx installation path based on OS
   */
  static async detectNginxPath(): Promise<string | null> {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        // macOS - Check common locations
        const possiblePaths = [
          '/usr/local/etc/nginx', // Homebrew
          '/opt/homebrew/etc/nginx', // Homebrew on Apple Silicon
          '/etc/nginx', // Manual installation
          '/usr/local/nginx/conf', // Manual compilation
        ];

        for (const nginxPath of possiblePaths) {
          try {
            await fs.access(nginxPath);
            return nginxPath;
          } catch {
            // Path doesn't exist, continue
          }
        }

        // Try to find nginx via which command
        try {
          const { stdout } = await execAsync('which nginx');
          const nginxBin = stdout.trim();
          if (nginxBin) {
            // Get config path from nginx
            const { stdout: configPath } = await execAsync(`${nginxBin} -t 2>&1 | grep "configuration file" | awk '{print $4}'`);
            if (configPath) {
              return path.dirname(configPath.trim());
            }
          }
        } catch {
          // nginx not in PATH
        }
      } else if (platform === 'linux') {
        // Linux - Check common locations
        const possiblePaths = [
          '/etc/nginx', // Most common on Linux
          '/usr/local/nginx/conf', // Manual compilation
          '/opt/nginx/conf', // Some custom installations
        ];

        for (const nginxPath of possiblePaths) {
          try {
            await fs.access(nginxPath);
            return nginxPath;
          } catch {
            // Path doesn't exist, continue
          }
        }
      } else if (platform === 'win32') {
        // Windows - Check common locations
        const possiblePaths = [
          'C:\\nginx\\conf',
          'C:\\Program Files\\nginx\\conf',
          'C:\\Program Files (x86)\\nginx\\conf',
          path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nginx', 'conf'),
        ];

        for (const nginxPath of possiblePaths) {
          try {
            await fs.access(nginxPath);
            return nginxPath;
          } catch {
            // Path doesn't exist, continue
          }
        }

        // Check if nginx is in PATH
        try {
          const { stdout } = await execAsync('where nginx');
          const nginxBin = stdout.trim().split('\n')[0];
          if (nginxBin) {
            const binDir = path.dirname(nginxBin);
            const confPath = path.join(path.dirname(binDir), 'conf');
            await fs.access(confPath);
            return confPath;
          }
        } catch {
          // nginx not in PATH
        }
      }
    } catch (error) {
      console.error('Error detecting nginx path:', error);
    }

    return null;
  }

  /**
   * Get nginx sites-enabled directory
   */
  static getNginxSitesPath(nginxPath: string): string {
    if (process.platform === 'win32') {
      return path.join(nginxPath, 'sites-enabled');
    }
    return path.join(nginxPath, 'sites-enabled');
  }

  /**
   * Get nginx config file path for a domain
   */
  static getDomainConfigPath(nginxPath: string, domainName: string): string {
    const sitesPath = this.getNginxSitesPath(nginxPath);
    return path.join(sitesPath, `${domainName}.conf`);
  }

  /**
   * Check if nginx is installed
   */
  static async isNginxInstalled(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        await execAsync('where nginx');
      } else {
        await execAsync('which nginx');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if nginx config file exists for a domain
   */
  static async configExists(nginxPath: string, domainName: string): Promise<boolean> {
    try {
      const configPath = this.getDomainConfigPath(nginxPath, domainName);
      await fs.access(configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create nginx config directory if it doesn't exist
   */
  static async ensureNginxDirectory(nginxPath: string): Promise<void> {
    const sitesPath = this.getNginxSitesPath(nginxPath);
    try {
      await fs.mkdir(sitesPath, { recursive: true });
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        // Try with elevated privileges
        await this.createDirectoryWithSudo(sitesPath);
      } else {
        throw error;
      }
    }
  }

  /**
   * Write nginx config file with elevated privileges if needed
   */
  static async writeNginxConfig(nginxPath: string, domainName: string, config: string): Promise<void> {
    const configPath = this.getDomainConfigPath(nginxPath, domainName);
    
    try {
      await this.ensureNginxDirectory(nginxPath);
      await fs.writeFile(configPath, config);
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        await this.writeWithElevatedPrivileges(configPath, config);
      } else {
        throw error;
      }
    }
  }

  /**
   * Reload nginx service
   */
  static async reloadNginx(): Promise<void> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // macOS - Try nginx reload command
        try {
          await execAsync('nginx -s reload');
        } catch (error: any) {
          // Check if nginx is running
          try {
            await execAsync('pgrep nginx');
          } catch {
            throw new Error('Nginx is not running. Please start nginx first.');
          }
          
          // If that fails, try with sudo
          try {
            await this.execWithSudo('nginx -s reload');
          } catch (sudoError: any) {
            // If user cancelled sudo prompt
            if (sudoError.message?.includes('User did not grant permission') || 
                sudoError.message?.includes('cancelled')) {
              throw new Error('Permission denied. Please reload nginx manually.');
            }
            throw sudoError;
          }
        }
      } else if (platform === 'linux') {
        // Linux - Try systemctl first
        try {
          await execAsync('systemctl reload nginx');
        } catch {
          // Try with sudo
          try {
            await this.execWithSudo('systemctl reload nginx');
          } catch (error: any) {
            // If user cancelled sudo prompt
            if (error.message?.includes('User did not grant permission') || 
                error.message?.includes('cancelled')) {
              throw new Error('Permission denied. Please reload nginx manually.');
            }
            // Try service command
            try {
              await this.execWithSudo('service nginx reload');
            } catch {
              throw new Error('Failed to reload nginx. Please reload it manually.');
            }
          }
        }
      } else if (platform === 'win32') {
        // Windows - nginx reload
        try {
          await execAsync('nginx -s reload');
        } catch (error: any) {
          throw new Error('Failed to reload nginx. Please run "nginx -s reload" as administrator.');
        }
      }
    } catch (error: any) {
      console.error('Error reloading nginx:', error);
      // Re-throw with the original message if it's already a custom error
      if (error.message?.includes('Please')) {
        throw error;
      }
      throw new Error('Failed to reload nginx. Please reload it manually.');
    }
  }

  /**
   * Test nginx configuration
   */
  static async testNginxConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const { stdout, stderr } = await execAsync('nginx -t');
      return { valid: true };
    } catch (error: any) {
      return { 
        valid: false, 
        error: error.stderr || error.message 
      };
    }
  }

  /**
   * Create directory with sudo
   */
  private static async createDirectoryWithSudo(dirPath: string): Promise<void> {
    const command = process.platform === 'win32'
      ? `mkdir "${dirPath}"`
      : `mkdir -p "${dirPath}"`;

    return new Promise<void>((resolve, reject) => {
      const options = {
        name: this.appName,
        env: {
          PATH: process.env.PATH || ''
        }
      };

      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (stderr && stderr.toString().trim()) {
          reject(new Error(stderr.toString()));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Write file with elevated privileges
   */
  private static async writeWithElevatedPrivileges(filePath: string, content: string): Promise<void> {
    // Check if already elevated
    if (isElevated()) {
      await fs.writeFile(filePath, content);
      return;
    }

    const tmpFile = path.join(os.tmpdir(), `nginx_temp_${Date.now()}`);
    
    // Write to temp file
    await fs.writeFile(tmpFile, content);

    try {
      // Cross-platform command to copy the temp file
      let command: string;
      
      if (process.platform === 'win32') {
        command = `copy /Y "${tmpFile}" "${filePath}"`;
      } else {
        command = `cp "${tmpFile}" "${filePath}"`;
      }

      // Execute with elevated privileges
      await new Promise<void>((resolve, reject) => {
        const options = {
          name: this.appName,
          env: {
            PATH: process.env.PATH || ''
          }
        };

        sudo.exec(command, options, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else if (stderr && stderr.toString().trim()) {
            reject(new Error(stderr.toString()));
          } else {
            resolve();
          }
        });
      });
    } finally {
      // Clean up temp file
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  /**
   * Execute command with sudo
   */
  private static async execWithSudo(command: string): Promise<void> {
    // Check if already elevated
    if (isElevated()) {
      await execAsync(command);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const options = {
        name: this.appName,
        env: {
          PATH: process.env.PATH || ''
        }
      };

      sudo.exec(command, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (stderr && stderr.toString().trim()) {
          reject(new Error(stderr.toString()));
        } else {
          resolve();
        }
      });
    });
  }
}