import { sql } from 'drizzle-orm';
import { 
  sqliteTable, 
  text, 
  integer, 
  real,
  primaryKey,
  index,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

// Domains table
export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  ipAddress: text('ip_address').notNull(),
  port: integer('port').default(80),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  description: text('description'),
  category: text('category'),
  tags: text('tags'), // JSON array stored as text
  parentId: integer('parent_id').references(() => domains.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  nameIdx: uniqueIndex('idx_domain_name').on(table.name),
  categoryIdx: index('idx_domain_category').on(table.category),
  parentIdx: index('idx_domain_parent').on(table.parentId),
}));

// DNS Records table
export const dnsRecords = sqliteTable('dns_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV'] }).notNull(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  ttl: integer('ttl').default(3600),
  priority: integer('priority'), // For MX records
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  domainIdx: index('idx_dns_domain').on(table.domainId),
  typeIdx: index('idx_dns_type').on(table.type),
}));

// Monitoring data table
export const monitoringData = sqliteTable('monitoring_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['up', 'down', 'degraded'] }).notNull(),
  responseTime: real('response_time'), // in milliseconds
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  checkedAt: integer('checked_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  domainIdx: index('idx_monitoring_domain').on(table.domainId),
  checkedAtIdx: index('idx_monitoring_checked_at').on(table.checkedAt),
}));

// Analytics data table
export const analyticsData = sqliteTable('analytics_data', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  event: text('event').notNull(), // 'request', 'error', 'performance'
  data: text('data').notNull(), // JSON data
  timestamp: integer('timestamp', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  domainEventIdx: index('idx_analytics_domain_event').on(table.domainId, table.event),
  timestampIdx: index('idx_analytics_timestamp').on(table.timestamp),
}));

// SSL Certificates table
export const sslCertificates = sqliteTable('ssl_certificates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domainId: integer('domain_id').notNull().references(() => domains.id, { onDelete: 'cascade' }),
  issuer: text('issuer'),
  validFrom: integer('valid_from', { mode: 'timestamp' }),
  validTo: integer('valid_to', { mode: 'timestamp' }),
  fingerprint: text('fingerprint'),
  isValid: integer('is_valid', { mode: 'boolean' }).default(true),
  lastChecked: integer('last_checked', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  domainIdx: index('idx_ssl_domain').on(table.domainId),
}));

// Type exports
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DnsRecord = typeof dnsRecords.$inferSelect;
export type NewDnsRecord = typeof dnsRecords.$inferInsert;
export type MonitoringData = typeof monitoringData.$inferSelect;
export type NewMonitoringData = typeof monitoringData.$inferInsert;
export type AnalyticsData = typeof analyticsData.$inferSelect;
export type NewAnalyticsData = typeof analyticsData.$inferInsert;
export type SslCertificate = typeof sslCertificates.$inferSelect;
export type NewSslCertificate = typeof sslCertificates.$inferInsert;