import type { FieldSchema, TableRecord } from "./types";

const BASE_URL = "http://localhost:3000";

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return resp.json() as Promise<T>;
}

// ======================= EXPORT DB =======================
// Завантаження JSON-файлу БД
export async function exportDatabase(): Promise<Blob> {
  const resp = await fetch(`${BASE_URL}/database/export`);
  return resp.blob();
}

// ======================= IMPORT DB =======================
// Відправка JSON-об'єкта на сервер для імпорту
export async function importDatabase(json: unknown): Promise<void> {
  await jsonFetch(`${BASE_URL}/database/load-file`, {
    method: "POST",
    body: JSON.stringify(json),
  });
}

export function normalizeDatabaseFormat(json: any) {
  if (!json || typeof json !== "object") return json;

  // Гарантуємо наявність імені БД
  if (!json.name) json.name = "ImportedDB";

  if (!Array.isArray(json.tables)) return json;

  json.tables = json.tables.map((table: any) => {
    // Гарантуємо nextId
    let maxId = 0;

    table.records = (table.records || []).map((rec: any) => {
      // Визначаємо maxId
      if (typeof rec.id === "number" && rec.id > maxId) {
        maxId = rec.id;
      }

      // Якщо data уже є — все ок
      if (rec.data) return rec;

      // Якщо старий формат cells → конвертуємо
      if (Array.isArray(rec.cells)) {
        const data: Record<string, any> = {};
        rec.cells.forEach((cell: any) => {
          data[cell.field] = cell.value;
        });

        return { id: rec.id, data };
      }

      return rec;
    });

    table.nextId = maxId + 1;

    return table;
  });

  return json;
}

// ======================= TABLES =======================

export async function getTables(): Promise<string[]> {
  return jsonFetch<string[]>(`${BASE_URL}/tables`);
}

export async function getTableSchema(name: string): Promise<FieldSchema[]> {
  return jsonFetch<FieldSchema[]>(`${BASE_URL}/tables/${encodeURIComponent(name)}/schema`);
}

export async function createTable(
  name: string,
  fields: {
    name: string;
    type: string;
    isRequired: boolean;
    maxLength?: number;
    enumValues?: string[];
  }[],
): Promise<void> {
  await jsonFetch(`${BASE_URL}/tables`, {
    method: "POST",
    body: JSON.stringify({ name, fields }),
  });
}

// ======================= RECORDS =======================

export async function getTableRecords(name: string): Promise<TableRecord[]> {
  return jsonFetch<TableRecord[]>(`${BASE_URL}/tables/${encodeURIComponent(name)}/records`);
}

export async function addRecord(
  tableName: string,
  data: Record<string, unknown>,
): Promise<void> {
  await jsonFetch(`${BASE_URL}/tables/${encodeURIComponent(tableName)}/records`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ======================= SORT =======================

export async function sortTable(
  tableName: string,
  fieldName: string,
  asc: boolean,
): Promise<void> {
  await jsonFetch(`${BASE_URL}/tables/${encodeURIComponent(tableName)}/sort`, {
    method: "POST",
    body: JSON.stringify({ fieldName, asc }),
  });
}

// ======================= FILTER (individual op) =======================

export async function filterTable(
  tableName: string,
  fieldName: string,
  operator: string,
  value: unknown,
): Promise<TableRecord[]> {
  return jsonFetch<TableRecord[]>(`${BASE_URL}/tables/${encodeURIComponent(tableName)}/filter`, {
    method: "POST",
    body: JSON.stringify({ fieldName, operator, value }),
  });
}

// ======================= SAVE/LOAD (old API) =======================

export async function saveDatabase(): Promise<void> {
  await jsonFetch(`${BASE_URL}/database/save`, { method: "POST" });
}

export async function loadDatabase(): Promise<string[]> {
  const result = await jsonFetch<{ success: boolean; tables: string[] }>(
    `${BASE_URL}/database/load`,
    { method: "POST" },
  );
  return result.tables;
}
