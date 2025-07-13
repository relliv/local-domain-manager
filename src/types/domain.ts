export interface Domain {
  id: number;
  name: string;
  ip_address: string;
  port?: number;
  is_active: boolean;
  description?: string;
  category?: string;
  tags?: string;
  created_at: string;
  updated_at: string;
}

export interface DomainFormData {
  name: string;
  ip_address: string;
  port?: number;
  is_active: boolean;
  description?: string;
  category?: string;
  tags?: string;
}