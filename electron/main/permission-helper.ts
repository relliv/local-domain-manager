import { dialog, shell } from 'electron';
import * as os from 'os';

const appName = 'Local Domain Manager';

export class PermissionHelper {
  /**
   * Get the application name for permission dialogs
   */
  static getAppName(): string {
    return appName;
  }

  /**
   * Get platform-specific permission message
   */
  static getPermissionMessage(): string {
    const platform = process.platform;
    
    if (platform === 'darwin') {
      return 'Local Domain Manager needs to modify your hosts file. You will be prompted for your password.';
    } else if (platform === 'win32') {
      return 'Local Domain Manager needs administrator permission to modify the hosts file. Please click "Yes" in the UAC dialog.';
    } else {
      return 'Local Domain Manager needs administrator permission to modify the hosts file. Please enter your password when prompted.';
    }
  }

  static async showPermissionError(): Promise<void> {
    const platform = process.platform;
    let detail = 'Local Domain Manager could not modify the hosts file. ';
    
    if (platform === 'darwin') {
      detail += 'Please enter your password when prompted to grant permission.';
    } else if (platform === 'win32') {
      detail += 'Please click "Yes" in the User Account Control dialog to grant permission.';
    } else {
      detail += 'Please enter your password when prompted to grant administrator privileges.';
    }
    
    await dialog.showMessageBox({
      type: 'error',
      title: 'Permission Denied',
      message: 'Failed to modify hosts file',
      detail: detail,
      buttons: ['OK'],
      defaultId: 0,
    });
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