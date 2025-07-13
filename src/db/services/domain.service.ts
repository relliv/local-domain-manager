import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import { domains } from '../schema';
import type { Domain, DomainFormData } from '@/types/domain';

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
    const db = getDb();
    const result = await db.insert(domains).values({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).returning().get();
    return result as Domain;
  }

  static async updateDomain(id: number, data: Partial<DomainFormData>): Promise<Domain | undefined> {
    const db = getDb();
    const result = await db.update(domains)
      .set({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .where(eq(domains.id, id))
      .returning()
      .get();
    return result as Domain | undefined;
  }

  static async deleteDomain(id: number): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(domains).where(eq(domains.id, id)).run();
    return result.changes > 0;
  }

  static async toggleDomainStatus(id: number): Promise<Domain | undefined> {
    const domain = await this.getDomainById(id);
    if (!domain) return undefined;
    
    return this.updateDomain(id, { is_active: !domain.is_active });
  }
}