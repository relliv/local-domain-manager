export interface Domain {
  id: number;
  name: string;
  ip_address: string;
  port?: number;
  is_active: boolean;
  description?: string;
  category?: string;
  tags?: string;
  parent_id?: number;
  created_at: string;
  updated_at: string;
  // For tree view
  children?: Domain[];
  level?: number;
  isExpanded?: boolean;
}

export interface DomainFormData {
  name: string;
  ip_address?: string;
  port?: number;
  is_active: boolean;
  description?: string;
  category?: string;
  tags?: string;
  parent_id?: number;
}

export interface DomainTreeNode extends Domain {
  children: DomainTreeNode[];
  level: number;
  isExpanded: boolean;
}