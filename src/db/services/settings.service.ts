import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { settings } from '../schema';
import type { Settings, NewSettings } from '../schema';

export class SettingsService {
  /**
   * Get a setting by key
   */
  static async getSetting(key: string): Promise<string | null> {
    const db = getDb();
    const result = await db.select().from(settings).where(eq(settings.key, key)).get();
    return result ? result.value : null;
  }

  /**
   * Set a setting value
   */
  static async setSetting(key: string, value: string, description?: string): Promise<Settings> {
    const db = getDb();
    
    // Check if setting exists
    const existing = await this.getSetting(key);
    
    if (existing !== null) {
      // Update existing setting
      const result = await db.update(settings)
        .set({ value, description })
        .where(eq(settings.key, key))
        .returning()
        .get();
      return result!;
    } else {
      // Create new setting
      const result = await db.insert(settings)
        .values({ key, value, description })
        .returning()
        .get();
      return result;
    }
  }

  /**
   * Get all settings
   */
  static async getAllSettings(): Promise<Settings[]> {
    const db = getDb();
    return await db.select().from(settings).all();
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(key: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(settings).where(eq(settings.key, key)).run();
    return result.changes > 0;
  }

  /**
   * Get nginx path setting
   */
  static async getNginxPath(): Promise<string | null> {
    return this.getSetting('nginx_path');
  }

  /**
   * Set nginx path setting
   */
  static async setNginxPath(path: string): Promise<Settings> {
    return this.setSetting('nginx_path', path, 'Nginx configuration directory path');
  }

  /**
   * Get nginx binary path
   */
  static async getNginxBinary(): Promise<string | null> {
    return this.getSetting('nginx_binary');
  }

  /**
   * Set nginx binary path
   */
  static async setNginxBinary(path: string): Promise<Settings> {
    return this.setSetting('nginx_binary', path, 'Nginx executable binary path');
  }

  /**
   * Check if initial setup is complete
   */
  static async isInitialSetupComplete(): Promise<boolean> {
    const nginxPath = await this.getNginxPath();
    return nginxPath !== null;
  }

  /**
   * Get default settings for initialization
   */
  static getDefaultSettings(): Array<{ key: string; value: string; description: string }> {
    return [
      {
        key: 'auto_reload_nginx',
        value: 'true',
        description: 'Automatically reload nginx after configuration changes'
      },
      {
        key: 'backup_before_changes',
        value: 'true',
        description: 'Create backup of nginx config before making changes'
      },
      {
        key: 'websocket_support_default',
        value: 'true',
        description: 'Enable websocket support by default for new reverse proxies'
      },
      {
        key: 'validate_config_before_save',
        value: 'true',
        description: 'Validate nginx configuration before saving'
      }
    ];
  }

  /**
   * Initialize default settings
   */
  static async initializeDefaults(): Promise<void> {
    const defaults = this.getDefaultSettings();
    
    for (const setting of defaults) {
      const existing = await this.getSetting(setting.key);
      if (existing === null) {
        await this.setSetting(setting.key, setting.value, setting.description);
      }
    }
  }
}