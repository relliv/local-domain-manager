import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface HostEntry {
  ip: string;
  hostname: string;
  comment?: string;
}

export class HostFileService {
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
    const platform = process.platform;
    
    if (platform === 'darwin' || platform === 'linux') {
      // On macOS and Linux, we'll create a temporary file and use sudo
      const tmpFile = path.join(os.tmpdir(), `hosts_temp_${Date.now()}`);
      
      if (mode === 'append') {
        // For append, we need to read existing content first
        const existingContent = await this.readHostFile();
        await fs.writeFile(tmpFile, existingContent + content);
      } else {
        await fs.writeFile(tmpFile, content);
      }

      try {
        // Use osascript on macOS to prompt for admin privileges
        if (platform === 'darwin') {
          const script = `do shell script "cp '${tmpFile}' '${hostPath}'" with administrator privileges`;
          await execAsync(`osascript -e '${script}'`);
        } else {
          // On Linux, use pkexec or gksudo if available
          try {
            await execAsync(`pkexec cp "${tmpFile}" "${hostPath}"`);
          } catch {
            // Fallback to sudo (won't work in GUI apps)
            await execAsync(`sudo cp "${tmpFile}" "${hostPath}"`);
          }
        }
      } finally {
        // Clean up temp file
        await fs.unlink(tmpFile).catch(() => {});
      }
    } else if (platform === 'win32') {
      // On Windows, we need to use PowerShell with elevation
      const tmpFile = path.join(os.tmpdir(), `hosts_temp_${Date.now()}`);
      
      if (mode === 'append') {
        const existingContent = await this.readHostFile();
        await fs.writeFile(tmpFile, existingContent + content);
      } else {
        await fs.writeFile(tmpFile, content);
      }

      const command = `Start-Process powershell -Verb RunAs -ArgumentList "Copy-Item -Path '${tmpFile}' -Destination '${hostPath}' -Force"`;
      
      try {
        await execAsync(`powershell -Command "${command}"`);
        // Wait a bit for the operation to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        await fs.unlink(tmpFile).catch(() => {});
      }
    }
  }

  static async flushDNSCache(): Promise<void> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // macOS
        await execAsync('sudo dscacheutil -flushcache');
      } else if (platform === 'linux') {
        // Try various Linux DNS cache flush commands
        try {
          await execAsync('sudo systemctl restart systemd-resolved');
        } catch {
          try {
            await execAsync('sudo service nscd restart');
          } catch {
            // Some systems don't have DNS caching
          }
        }
      } else if (platform === 'win32') {
        // Windows
        await execAsync('ipconfig /flushdns');
      }
    } catch (error) {
      console.error('Error flushing DNS cache:', error);
      // Don't throw - DNS flush is not critical
    }
  }
}