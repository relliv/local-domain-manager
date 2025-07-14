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
    const tmpFile = path.join(os.tmpdir(), `hosts_temp_${Date.now()}`);
    
    // Prepare the temporary file
    if (mode === 'append') {
      const existingContent = await this.readHostFile();
      await fs.writeFile(tmpFile, existingContent + content);
    } else {
      await fs.writeFile(tmpFile, content);
    }

    try {
      if (platform === 'darwin') {
        // macOS: Use osascript to trigger the native authorization dialog
        const appName = 'Local Domain Manager';
        const script = `
          set tmpFile to "${tmpFile}"
          set hostFile to "${hostPath}"
          
          try
            do shell script "cp '" & tmpFile & "' '" & hostFile & "'" with administrator privileges
            return "success"
          on error errMsg
            return "error: " & errMsg
          end try
        `;
        
        const result = await execAsync(`osascript -e '${script.trim()}'`);
        
        if (result.stderr || (result.stdout && result.stdout.includes('error:'))) {
          throw new Error('User cancelled or permission denied');
        }
      } else if (platform === 'linux') {
        // Linux: Try different elevation methods
        const elevationCommands = [
          // pkexec (PolicyKit) - shows graphical dialog on most modern distros
          {
            cmd: 'pkexec',
            args: ['cp', tmpFile, hostPath],
            name: 'PolicyKit'
          },
          // gksudo - older but still present on some systems
          {
            cmd: 'gksudo',
            args: ['-m', 'Local Domain Manager needs to update your hosts file', `cp "${tmpFile}" "${hostPath}"`],
            name: 'gksudo'
          },
          // kdesudo - for KDE systems
          {
            cmd: 'kdesudo',
            args: ['--comment', 'Local Domain Manager needs to update your hosts file', '-c', `cp "${tmpFile}" "${hostPath}"`],
            name: 'kdesudo'
          }
        ];

        let success = false;
        let lastError: Error | null = null;

        for (const elevation of elevationCommands) {
          try {
            await execAsync(`which ${elevation.cmd}`);
            await execAsync(`${elevation.cmd} ${elevation.args.join(' ')}`);
            success = true;
            break;
          } catch (error: any) {
            lastError = error;
            continue;
          }
        }

        if (!success) {
          // If no GUI elevation tool is available, try sudo with a message
          try {
            await execAsync(`sudo -p "Local Domain Manager needs administrator access to update hosts file. Password: " cp "${tmpFile}" "${hostPath}"`);
          } catch (error) {
            throw new Error('Permission denied. Please run the application with administrator privileges.');
          }
        }
      } else if (platform === 'win32') {
        // Windows: Create a VBScript to show UAC prompt
        const vbsFile = path.join(os.tmpdir(), `elevate_${Date.now()}.vbs`);
        const vbsContent = `
          Set UAC = CreateObject("Shell.Application")
          UAC.ShellExecute "cmd.exe", "/c copy /Y """ & "${tmpFile.replace(/\\/g, '\\\\')}" & """ """ & "${hostPath.replace(/\\/g, '\\\\')}" & """", "", "runas", 1
        `;
        
        await fs.writeFile(vbsFile, vbsContent.trim());
        
        try {
          // Execute the VBScript which will show UAC prompt
          await execAsync(`cscript //NoLogo "${vbsFile}"`);
          
          // Wait for the operation to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Verify the file was updated
          const stats = await fs.stat(hostPath);
          const tmpStats = await fs.stat(tmpFile);
          
          if (stats.mtime < tmpStats.mtime) {
            throw new Error('Host file was not updated. Permission may have been denied.');
          }
        } finally {
          await fs.unlink(vbsFile).catch(() => {});
        }
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