import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as sudo from '@vscode/sudo-prompt';
import isElevated from 'native-is-elevated';

const execAsync = promisify(exec);

export interface HostEntry {
  ip: string;
  hostname: string;
  comment?: string;
}

export class HostFileService {
  private static readonly appName = 'Local Domain Manager';

  private static getHostFilePath(): string {
    if (process.platform === 'win32') {
      return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
    }
    return '/etc/hosts';
  }

  static async readHostFile(): Promise<string> {
    try {
      const hostPath = this.getHostFilePath();
      return await fs.readFile(hostPath, 'utf-8');
    } catch (error) {
      console.error('Error reading host file:', error);
      throw new Error('Failed to read host file. Permission denied.');
    }
  }

  static async parseHostFile(): Promise<HostEntry[]> {
    const content = await this.readHostFile();
    const lines = content.split('\n');
    const entries: HostEntry[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Parse host entry
      const parts = trimmedLine.split(/\s+/);
      if (parts.length >= 2) {
        const [ip, ...hostnames] = parts;
        // Look for inline comments
        const commentIndex = hostnames.findIndex(h => h.includes('#'));
        
        if (commentIndex >= 0) {
          const actualHostnames = hostnames.slice(0, commentIndex);
          const comment = hostnames.slice(commentIndex).join(' ');
          
          for (const hostname of actualHostnames) {
            entries.push({ ip, hostname, comment });
          }
        } else {
          for (const hostname of hostnames) {
            entries.push({ ip, hostname });
          }
        }
      }
    }

    return entries;
  }

  static async checkHostExists(hostname: string): Promise<boolean> {
    try {
      const entries = await this.parseHostFile();
      return entries.some(entry => entry.hostname === hostname);
    } catch (error) {
      console.error('Error checking host:', error);
      return false;
    }
  }

  static async addHostEntry(ip: string, hostname: string, comment?: string): Promise<void> {
    const hostPath = this.getHostFilePath();
    
    // Check if entry already exists
    const exists = await this.checkHostExists(hostname);
    if (exists) {
      throw new Error(`Host entry for ${hostname} already exists`);
    }

    // Prepare the new entry
    const timestamp = new Date().toISOString();
    const commentText = comment || `Added by Local Domain Manager on ${timestamp}`;
    const newEntry = `\n${ip}\t${hostname}\t# ${commentText}`;

    try {
      // Try to append directly first
      await fs.appendFile(hostPath, newEntry);
    } catch (error: any) {
      // If permission denied, try with elevated privileges
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        await this.writeWithElevatedPrivileges(hostPath, newEntry, 'append');
      } else {
        throw error;
      }
    }
  }

  static async removeHostEntry(hostname: string): Promise<void> {
    const hostPath = this.getHostFilePath();
    const content = await this.readHostFile();
    const lines = content.split('\n');
    
    // Filter out lines containing the hostname
    const newLines = lines.filter(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return true; // Keep empty lines and comments
      }
      
      const parts = trimmedLine.split(/\s+/);
      if (parts.length >= 2) {
        const [, ...hostnames] = parts;
        return !hostnames.includes(hostname);
      }
      
      return true;
    });

    const newContent = newLines.join('\n');

    try {
      await fs.writeFile(hostPath, newContent);
    } catch (error: any) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        await this.writeWithElevatedPrivileges(hostPath, newContent, 'write');
      } else {
        throw error;
      }
    }
  }

  static async updateHostEntry(oldHostname: string, newIp: string, newHostname: string): Promise<void> {
    await this.removeHostEntry(oldHostname);
    await this.addHostEntry(newIp, newHostname);
  }

  private static async writeWithElevatedPrivileges(hostPath: string, content: string, mode: 'write' | 'append'): Promise<void> {
    // Check if already elevated
    if (isElevated()) {
      // If already elevated, write directly
      if (mode === 'append') {
        await fs.appendFile(hostPath, content);
      } else {
        await fs.writeFile(hostPath, content);
      }
      return;
    }

    const tmpFile = path.join(os.tmpdir(), `hosts_temp_${Date.now()}`);
    
    // Prepare the temporary file
    if (mode === 'append') {
      const existingContent = await this.readHostFile();
      await fs.writeFile(tmpFile, existingContent + content);
    } else {
      await fs.writeFile(tmpFile, content);
    }

    try {
      // Cross-platform command to copy the temp file to hosts file
      let command: string;
      
      if (process.platform === 'win32') {
        // Windows command
        command = `copy /Y "${tmpFile}" "${hostPath}"`;
      } else {
        // Unix-like systems (macOS, Linux)
        command = `cp "${tmpFile}" "${hostPath}"`;
      }

      // Execute with elevated privileges using @vscode/sudo-prompt
      // This will show native OS authentication dialog
      await new Promise<void>((resolve, reject) => {
        const options = {
          name: this.appName,
          env: {
            PATH: process.env.PATH || ''
          }
        };

        sudo.exec(command, options, (error, _stdout, stderr) => {
          if (error) {
            console.error('Sudo error:', error);
            reject(error);
          } else if (stderr && stderr.toString().trim()) {
            console.error('Sudo stderr:', stderr);
            reject(new Error(stderr.toString()));
          } else {
            console.log('Hosts file updated successfully');
            resolve();
          }
        });
      });

    } catch (error: any) {
      console.error('Error executing sudo command:', error);
      
      // Handle specific error cases
      if (error.message && error.message.includes('User did not grant permission')) {
        throw new Error('Permission denied: User cancelled the authentication dialog');
      } else if (error.message && error.message.includes('cancelled')) {
        throw new Error('Operation cancelled by user');
      } else if (error.code === 126) {
        throw new Error('Permission denied: Unable to execute command with elevated privileges');
      } else {
        throw new Error('Failed to update hosts file with elevated privileges: ' + error.message);
      }
    } finally {
      // Clean up temp file
      await fs.unlink(tmpFile).catch(() => {});
    }
  }

  static async flushDNSCache(): Promise<void> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // macOS - requires sudo
        await this.execWithSudo('dscacheutil -flushcache');
      } else if (platform === 'linux') {
        // Try various Linux DNS cache flush commands
        try {
          await this.execWithSudo('systemctl restart systemd-resolved');
        } catch {
          try {
            await this.execWithSudo('service nscd restart');
          } catch {
            // Some systems don't have DNS caching
            console.log('DNS cache flush not available on this system');
          }
        }
      } else if (platform === 'win32') {
        // Windows - doesn't require elevation for flushdns
        await execAsync('ipconfig /flushdns');
      }
    } catch (error) {
      console.error('Error flushing DNS cache:', error);
      // Don't throw - DNS flush is not critical
    }
  }

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