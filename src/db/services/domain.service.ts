import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { domains } from '../schema';
import type { Domain, DomainFormData } from '@/types/domain';
import { HostFileService } from '../../../electron/main/host-file.service';

// Helper to convert from DB format to Domain format
function dbToDomain(dbDomain: any): Domain {
  // Helper to safely convert timestamp to ISO string
  const toISOString = (timestamp: any): string => {
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // If it's a number, assume it's a Unix timestamp
    if (typeof timestamp === 'number') {
      // Check if it's in seconds or milliseconds
      // Unix timestamps before year 2001 in seconds would be less than 1000000000
      const date = timestamp < 10000000000 ? new Date(timestamp * 1000) : new Date(timestamp);
      return date.toISOString();
    }
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
      try {
        return new Date(timestamp).toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    
    return new Date().toISOString();
  };

  return {
    id: dbDomain.id,
    name: dbDomain.name,
    ip_address: dbDomain.ipAddress, // Drizzle maps ip_address column to ipAddress field
    port: dbDomain.port,
    is_active: dbDomain.isActive, // Drizzle maps is_active column to isActive field
    description: dbDomain.description,
    category: dbDomain.category,
    tags: dbDomain.tags,
    created_at: toISOString(dbDomain.createdAt),
    updated_at: toISOString(dbDomain.updatedAt),
  };
}

export class DomainService {
  static async getAllDomains(): Promise<Domain[]> {
    const db = getDb();
    const result = await db.select().from(domains).all();
    return result.map(dbToDomain);
  }

  static async getDomainById(id: number): Promise<Domain | undefined> {
    const db = getDb();
    const result = await db.select().from(domains).where(eq(domains.id, id)).get();
    return result ? dbToDomain(result) : undefined;
  }

  static async getDomainByName(name: string): Promise<Domain | undefined> {
    const db = getDb();
    const result = await db.select().from(domains).where(eq(domains.name, name)).get();
    return result ? dbToDomain(result) : undefined;
  }

  static async createDomain(data: DomainFormData): Promise<Domain> {
    // Check if domain already exists in database
    const existingDomain = await this.getDomainByName(data.name);
    if (existingDomain) {
      throw new Error(`DUPLICATE_DOMAIN:${data.name}`);
    }

    // Check if domain already exists in host file
    const hostExists = await HostFileService.checkHostExists(data.name);
    if (hostExists) {
      throw new Error(`Domain ${data.name} already exists in host file`);
    }

    // Save to database first with default IP
    const db = getDb();
    const now = new Date();
    const result = await db.insert(domains).values({
      name: data.name,
      ipAddress: '127.0.0.1', // Always use default IP
      port: data.port || 80,
      isActive: data.is_active,
      description: data.description,
      category: data.category,
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
    }).returning().get();

    // If active, add to host file
    if (data.is_active) {
      try {
        await HostFileService.addHostEntry(result.ipAddress, result.name, result.description || undefined);
        await HostFileService.flushDNSCache();
      } catch (error: any) {
        // If host file update fails, remove from database
        await db.delete(domains).where(eq(domains.id, result.id)).run();
        throw new Error(`Failed to update host file: ${error.message}`);
      }
    }

    return dbToDomain(result);
  }

  static async updateDomain(id: number, data: Partial<DomainFormData>): Promise<Domain | undefined> {
    const db = getDb();
    
    // Get the current domain
    const currentDomain = await this.getDomainById(id);
    if (!currentDomain) return undefined;

    // Update database (ensure IP address is never changed from 127.0.0.1)
    const updateData: any = {
      updatedAt: new Date()
    };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.port !== undefined) updateData.port = data.port;
    if (data.is_active !== undefined) updateData.isActive = data.is_active;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    
    const result = await db.update(domains)
      .set(updateData)
      .where(eq(domains.id, id))
      .returning()
      .get();

    if (!result) return undefined;

    // Handle host file updates
    try {
      // If domain name changed, update host file
      if (data.name && data.name !== currentDomain.name) {
        // Remove old entry if it was active
        if (currentDomain.is_active) {
          await HostFileService.removeHostEntry(currentDomain.name);
        }
        
        // Add new entry if active
        if (result.isActive) {
          await HostFileService.addHostEntry(result.ipAddress, result.name, result.description || undefined);
        }
      } else if (data.is_active !== undefined && data.is_active !== currentDomain.is_active) {
        // Just toggling active status
        if (data.is_active) {
          await HostFileService.addHostEntry(result.ipAddress, result.name, result.description || undefined);
        } else {
          await HostFileService.removeHostEntry(result.name);
        }
      }
      
      await HostFileService.flushDNSCache();
    } catch (error: any) {
      // Revert database changes on host file error
      await db.update(domains)
        .set({
          name: currentDomain.name,
          ipAddress: currentDomain.ip_address,
          isActive: currentDomain.is_active,
        })
        .where(eq(domains.id, id))
        .run();
      throw new Error(`Failed to update host file: ${error.message}`);
    }

    return dbToDomain(result);
  }

  static async deleteDomain(id: number): Promise<boolean> {
    const db = getDb();
    
    // Get domain before deleting
    const domain = await this.getDomainById(id);
    if (!domain) return false;

    // Delete from database
    const result = await db.delete(domains).where(eq(domains.id, id)).run();
    
    if (result.changes > 0) {
      // Remove from host file if it was active
      if (domain.is_active) {
        try {
          await HostFileService.removeHostEntry(domain.name);
          await HostFileService.flushDNSCache();
        } catch (error) {
          console.error('Failed to remove from host file:', error);
          // Don't fail the deletion if host file update fails
        }
      }
      return true;
    }
    
    return false;
  }

  static async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    const domain = await this.getDomainById(id);
    if (!domain) return undefined;
    
    return this.updateDomain(id, { is_active: !domain.is_active });
  }
}