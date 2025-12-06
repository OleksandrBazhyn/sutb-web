export interface FieldSchema {
  name: string;
  type: string; // "integer" | "real" | "string" | "char" | "email" | "enum"
  isRequired: boolean;
  maxLength?: number;
  enumValues?: string[];
}

export interface TableRecord {
  id: number;
  data: Record<string, unknown>;
}
