import { dialog, shell } from 'electron';
import * as sudo from 'sudo-prompt';
import * as os from 'os';

const appName = 'Local Domain Manager';

export class PermissionHelper {
  static async requestHostFilePermission(): Promise<boolean> {
    const platform = process.platform;
    
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Administrator Permission Required',
      message: 'Local Domain Manager needs administrator permission to modify your hosts file.',
      detail: platform === 'darwin' 
        ? 'You will be prompted to enter your password to allow host file modifications.'
        : 'This application needs elevated privileges to modify the system hosts file.',
      buttons: ['Grant Permission', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    return result.response === 0;
  }

  static async executeWithElevation(command: string): Promise<{ error: Error | null; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const options = {
        name: appName,
        icns: '/Applications/Local Domain Manager.app/Contents/Resources/icon.icns', // macOS only
      };

      sudo.exec(command, options, (error, stdout, stderr) => {
        resolve({ error, stdout: stdout || '', stderr: stderr || '' });
      });
    });
  }

  static async showPermissionError(): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'Permission Denied',
      message: 'Failed to modify hosts file',
      detail: 'Local Domain Manager could not modify the hosts file. Please ensure you have administrator privileges and try again.',
      buttons: ['Open System Preferences', 'OK'],
      defaultId: 1,
      cancelId: 1,
    });

    if (result.response === 0) {
      // Open system preferences
      if (process.platform === 'darwin') {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy');
      } else if (process.platform === 'win32') {
        shell.openExternal('ms-settings:privacy');
      }
    }
  }

  static async checkAdminRights(): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        // On Windows, check if running as admin
        const { exec } = require('child_process');
        return new Promise((resolve) => {
          exec('net session', (error) => {
            resolve(!error);
          });
        });
      } else {
        // On Unix-like systems, check if we can read the hosts file
        const fs = require('fs');
        try {
          fs.accessSync('/etc/hosts', fs.constants.R_OK);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }
}