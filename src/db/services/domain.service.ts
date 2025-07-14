import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { domains } from '../schema';
import type { Domain, DomainFormData } from '@/types/domain';
import { HostFileService } from '../../../electron/main/host-file.service';

// Helper to convert from DB format to Domain format
function dbToDomain(dbDomain: any): Domain {
  return {
    id: dbDomain.id,
    name: dbDomain.name,
    ip_address: dbDomain.ipAddress, // Drizzle maps ip_address column to ipAddress field
    port: dbDomain.port,
    is_active: dbDomain.isActive, // Drizzle maps is_active column to isActive field
    description: dbDomain.description,
    category: dbDomain.category,
    tags: dbDomain.tags,
    created_at: dbDomain.createdAt instanceof Date ? dbDomain.createdAt.toISOString() : 
                (typeof dbDomain.createdAt === 'number' ? new Date(dbDomain.createdAt * 1000).toISOString() :
                dbDomain.createdAt?.toString() || new Date().toISOString()),
    updated_at: dbDomain.updatedAt instanceof Date ? dbDomain.updatedAt.toISOString() : 
                (typeof dbDomain.updatedAt === 'number' ? new Date(dbDomain.updatedAt * 1000).toISOString() :
                dbDomain.updatedAt?.toString() || new Date().toISOString()),
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

  static async createDomain(data: DomainFormData): Promise<Domain> {
    // Check if domain already exists in host file
    const hostExists = await HostFileService.checkHostExists(data.name);
    if (hostExists) {
      throw new Error(`Domain ${data.name} already exists in host file`);
    }

    // Save to database first with default IP
    const db = getDb();
    const result = await db.insert(domains).values({
      name: data.name,
      ipAddress: '127.0.0.1', // Always use default IP
      port: data.port || 80,
      isActive: data.is_active,
      description: data.description,
      category: data.category,
      tags: data.tags,
    }).returning().get();

    // If active, add to host file
    if (data.is_active) {
      try {
        await HostFileService.addHostEntry(result.ipAddress, result.name, result.description);
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
    const updateData: any = {};
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