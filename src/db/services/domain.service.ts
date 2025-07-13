import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { domains } from '../schema';
import type { Domain, DomainFormData } from '@/types/domain';
import { HostFileService } from '@/services/host-file.service';

export class DomainService {
  static async getAllDomains(): Promise<Domain[]> {
    const db = getDb();
    const result = await db.select().from(domains).all();
    return result as Domain[];
  }

  static async getDomainById(id: number): Promise<Domain | undefined> {
    const db = getDb();
    const result = await db.select().from(domains).where(eq(domains.id, id)).get();
    return result as Domain | undefined;
  }

  static async createDomain(data: DomainFormData): Promise<Domain> {
    // Check if domain already exists in host file
    const hostExists = await HostFileService.checkHostExists(data.name);
    if (hostExists) {
      throw new Error(`Domain ${data.name} already exists in host file`);
    }

    // Save to database first
    const db = getDb();
    const result = await db.insert(domains).values({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning().get();

    // If active, add to host file
    if (data.is_active) {
      try {
        await HostFileService.addHostEntry(data.ip_address, data.name, data.description);
        await HostFileService.flushDNSCache();
      } catch (error) {
        // If host file update fails, remove from database
        await db.delete(domains).where(eq(domains.id, result.id)).run();
        throw new Error(`Failed to update host file: ${error.message}`);
      }
    }

    return result as Domain;
  }

  static async updateDomain(id: number, data: Partial<DomainFormData>): Promise<Domain | undefined> {
    const db = getDb();
    
    // Get the current domain
    const currentDomain = await this.getDomainById(id);
    if (!currentDomain) return undefined;

    // Update database
    const result = await db.update(domains)
      .set({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .where(eq(domains.id, id))
      .returning()
      .get();

    if (!result) return undefined;

    // Handle host file updates
    try {
      // If domain name or IP changed, update host file
      if (data.name && data.name !== currentDomain.name || 
          data.ip_address && data.ip_address !== currentDomain.ip_address) {
        
        // Remove old entry if it was active
        if (currentDomain.is_active) {
          await HostFileService.removeHostEntry(currentDomain.name);
        }
        
        // Add new entry if active
        if (result.is_active) {
          await HostFileService.addHostEntry(result.ip_address, result.name, result.description || undefined);
        }
      } else if (data.is_active !== undefined && data.is_active !== currentDomain.is_active) {
        // Just toggling active status
        if (data.is_active) {
          await HostFileService.addHostEntry(result.ip_address, result.name, result.description || undefined);
        } else {
          await HostFileService.removeHostEntry(result.name);
        }
      }
      
      await HostFileService.flushDNSCache();
    } catch (error) {
      // Revert database changes on host file error
      await db.update(domains)
        .set({
          name: currentDomain.name,
          ip_address: currentDomain.ip_address,
          is_active: currentDomain.is_active,
          updated_at: currentDomain.updated_at,
        })
        .where(eq(domains.id, id))
        .run();
      throw new Error(`Failed to update host file: ${error.message}`);
    }

    return result as Domain;
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