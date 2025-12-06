import { useEffect, useState } from "react";
import {
  getTables,
  getTableSchema,
  getTableRecords,
  createTable,
  addRecord,
  sortTable,
  filterTable,
  saveDatabase,
  loadDatabase,
  importDatabase,
  exportDatabase,
  normalizeDatabaseFormat
} from "./api";
import type { FieldSchema, TableRecord } from "./types";
import "./App.css";

type NewFieldState = {
  name: string;
  type: string;
  isRequired: boolean;
  maxLength: string;
  enumValues: string;
};

const FIELD_TYPES = ["string", "integer", "real", "char", "email", "enum"];

const FILTER_OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "LIKE"];

function App() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [schema, setSchema] = useState<FieldSchema[]>([]);
  const [records, setRecords] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Створення таблиці
  const [newTableName, setNewTableName] = useState("");
  const [newFields, setNewFields] = useState<NewFieldState[]>([
    { name: "", type: "string", isRequired: false, maxLength: "", enumValues: "" },
  ]);

  // Додавання запису
  const [newRecord, setNewRecord] = useState<Record<string, string>>({});

  // Фільтрація
  const [filterField, setFilterField] = useState("");
  const [filterOperator, setFilterOperator] = useState("=");
  const [filterValue, setFilterValue] = useState("");

  // Сортування
  const [sortField, setSortField] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  // ====== Helpers ======

  const handleError = (e: unknown) => {
    console.error(e);
    setError(e instanceof Error ? e.message : String(e));
  };

  const reloadTables = async () => {
    try {
      setError(null);
      const list = await getTables();
      setTables(list);
      // якщо вибрана таблиця випала – скинемо
      if (selectedTable && !list.includes(selectedTable)) {
        setSelectedTable(null);
        setSchema([]);
        setRecords([]);
      }
    } catch (e) {
      handleError(e);
    }
  };

  const loadTableData = async (tableName: string) => {
    try {
      setError(null);
      setLoading(true);
      const [s, r] = await Promise.all([
        getTableSchema(tableName),
        getTableRecords(tableName),
      ]);
      setSchema(s);
      setRecords(r);
      setFilterField("");
      setFilterValue("");
      setSortField("");
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  // ====== Lifecycle ======

  useEffect(() => {
    reloadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData(selectedTable);
    }
  }, [selectedTable]);

  // ====== Handlers: створення таблиці ======

  const handleAddFieldRow = () => {
    setNewFields(prev => [
      ...prev,
      { name: "", type: "string", isRequired: false, maxLength: "", enumValues: "" },
    ]);
  };

  const handleFieldChange = (index: number, patch: Partial<NewFieldState>) => {
    setNewFields(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      setError("Назва таблиці обов'язкова.");
      return;
    }
    try {
      setError(null);
      setLoading(true);

      const fieldsPayload = newFields
        .filter(f => f.name.trim())
        .map(f => ({
          name: f.name.trim(),
          type: f.type,
          isRequired: f.isRequired,
          maxLength: f.maxLength ? Number(f.maxLength) : undefined,
          enumValues:
          f.type === "enum" && f.enumValues.trim().length > 0
            ? f.enumValues
                .split("\n")
                .map(v => v.trim())
                .filter(v => v.length > 0)
            : undefined,
        }));

      if (fieldsPayload.length === 0) {
        setError("Необхідно додати хоча б одне поле з назвою.");
        setLoading(false);
        return;
      }

      await createTable(newTableName.trim(), fieldsPayload);
      await reloadTables();
      setNewTableName("");
      setNewFields([{ name: "", type: "string", isRequired: false, maxLength: "", enumValues: "" }]);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  // ====== Handlers: додавання запису ======

  const handleNewRecordChange = (fieldName: string, value: string) => {
    setNewRecord(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;
    try {
      setError(null);
      setLoading(true);
      // тут відправляємо строки, сервер сам конвертує й валідує
      await addRecord(selectedTable, newRecord);
      setNewRecord({});
      await loadTableData(selectedTable);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  // ====== Handlers: сортування ======

  const handleSort = async () => {
    if (!selectedTable || !sortField) return;
    try {
      setError(null);
      setLoading(true);
      await sortTable(selectedTable, sortField, sortAsc);
      await loadTableData(selectedTable);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  // ====== Handlers: фільтрація ======

  const handleFilter = async () => {
    if (!selectedTable || !filterField || !filterOperator) return;
    try {
      setError(null);
      setLoading(true);
      const filtered = await filterTable(selectedTable, filterField, filterOperator, filterValue);
      setRecords(filtered);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilter = async () => {
    if (!selectedTable) return;
    await loadTableData(selectedTable);
  };

  // ====== Handlers: save/load DB ======

  const handleSaveDb = async () => {
    try {
      setError(null);
      setLoading(true);
      await saveDatabase();
      alert("Базу даних збережено (remote-db.json).");
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDb = async () => {
    try {
      setError(null);
      setLoading(true);
      const loadedTables = await loadDatabase();
      setTables(loadedTables);
      if (loadedTables.length > 0) {
        setSelectedTable(loadedTables[0]);
      }
      alert("Базу даних відновлено.");
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  // ====== Render ======

  return (
    <div className="app">
      <header>
        <h1>SUTB – Web Client</h1>
        <div className="db-buttons">
          <button onClick={handleSaveDb} disabled={loading}>
            Зберегти на сервер
          </button>

          <button
            onClick={async () => {
              const blob = await exportDatabase();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "sutb-database.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Завантажити БД (JSON)
          </button>

          <button className="upload-btn">
            Імпорт БД
            <input
              type="file"
              accept="application/json"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;

                const text = await file.text();

                try {
                  const json = JSON.parse(text);
                  const normalized = normalizeDatabaseFormat(json);
                  await importDatabase(normalized);
                  await reloadTables();
                  alert("БД імпортовано");
                } catch {
                  alert("Некоректний JSON-файл");
                }
              }}
              className="upload-input"
            />
          </button>
        </div>
      </header>

      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="loading">Завантаження...</div>}

      <div className="layout">
        {/* Ліва панель: таблиці + створення таблиці */}
        <aside className="sidebar">
          <section>
            <h2>Таблиці</h2>
            <ul className="table-list">
              {tables.map(t => (
                <li
                  key={t}
                  className={t === selectedTable ? "selected" : ""}
                  onClick={() => setSelectedTable(t)}
                >
                  {t}
                </li>
              ))}
              {tables.length === 0 && <li>(Немає таблиць)</li>}
            </ul>
          </section>

          <section>
            <h2>Створити таблицю</h2>
            <form onSubmit={handleCreateTable} className="block">
              <label>
                Назва таблиці:
                <input
                  value={newTableName}
                  onChange={e => setNewTableName(e.target.value)}
                  placeholder="users"
                />
              </label>

              <h3>Поля</h3>
              {newFields.map((f, idx) => (
                <div className="field-row" key={idx}>
                  <input
                    placeholder="name"
                    value={f.name}
                    onChange={e => handleFieldChange(idx, { name: e.target.value })}
                  />
                  <select
                    value={f.type}
                    onChange={e => handleFieldChange(idx, { type: e.target.value })}
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={f.isRequired}
                      onChange={e => handleFieldChange(idx, { isRequired: e.target.checked })}
                    />
                    обов’язкове
                  </label>
                  <input
                    type="number"
                    placeholder="maxLength"
                    value={f.maxLength}
                    onChange={e => handleFieldChange(idx, { maxLength: e.target.value })}
                  />
                  {f.type === "enum" && (
                    <textarea
                      placeholder="кожне значення з нового рядка"
                      value={f.enumValues}
                      rows={3}
                      style={{ resize: "vertical" }}
                      onChange={e => handleFieldChange(idx, { enumValues: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <button type="button" onClick={handleAddFieldRow}>
                + поле
              </button>
              <button type="submit" disabled={loading}>
                Створити
              </button>
            </form>
          </section>
        </aside>

        {/* Права панель: вибрана таблиця */}
        <main className="main">
          {selectedTable ? (
            <>
              <h2>Таблиця: {selectedTable}</h2>

              <section className="block">
                <h3>Схема таблиці</h3>
                <table className="schema-table">
                  <thead>
                    <tr>
                      <th>Поле</th>
                      <th>Тип</th>
                      <th>Обов’язкове</th>
                      <th>Max length</th>
                      <th>Enum values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.map(f => (
                      <tr key={f.name}>
                        <td>{f.name}</td>
                        <td>{f.type}</td>
                        <td>{f.isRequired ? "так" : "ні"}</td>
                        <td>{f.maxLength ?? "-"}</td>
                        <td>{f.enumValues?.join(", ") ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="block">
                <h3>Фільтрація (індивідуальна операція)</h3>
                <div className="filter-row">
                  <select
                    value={filterField}
                    onChange={e => setFilterField(e.target.value)}
                  >
                    <option value="">Поле...</option>
                    {schema.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filterOperator}
                    onChange={e => setFilterOperator(e.target.value)}
                  >
                    {FILTER_OPERATORS.map(op => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <input
                    value={filterValue}
                    onChange={e => setFilterValue(e.target.value)}
                    placeholder="значення"
                  />
                  <button onClick={handleFilter} disabled={loading}>
                    Застосувати
                  </button>
                  <button onClick={handleResetFilter} disabled={loading}>
                    Скинути
                  </button>
                </div>
              </section>

              <section className="block">
                <h3>Сортування</h3>
                <div className="filter-row">
                  <select
                    value={sortField}
                    onChange={e => setSortField(e.target.value)}
                  >
                    <option value="">Поле...</option>
                    {schema.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={sortAsc}
                      onChange={e => setSortAsc(e.target.checked)}
                    />
                    за зростанням
                  </label>
                  <button onClick={handleSort} disabled={loading}>
                    Відсортувати
                  </button>
                </div>
              </section>

              <section className="block">
                <h3>Записи</h3>
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      {schema.map(f => (
                        <th key={f.name}>{f.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        {schema.map(f => (
                          <td key={f.name}>
                            {String(
                              r.data[f.name] === null || r.data[f.name] === undefined
                                ? ""
                                : r.data[f.name],
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={schema.length + 1}>(Поки немає записів)</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="block">
                <h3>Додати запис</h3>
                <form onSubmit={handleAddRecord} className="record-form">
                  {schema.map(f => (
                    <div key={f.name} className="record-field">
                      <label>
                        {f.name} ({f.type}
                        {f.isRequired ? ", *" : ""}):
                      </label>
                      {f.type === "enum" && f.enumValues && f.enumValues.length > 0 ? (
                        <select
                          value={newRecord[f.name] ?? ""}
                          onChange={e => handleNewRecordChange(f.name, e.target.value)}
                        >
                          <option value="">(оберіть)</option>
                          {f.enumValues.map(v => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={newRecord[f.name] ?? ""}
                          onChange={e => handleNewRecordChange(f.name, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                  <button type="submit" disabled={loading}>
                    Додати
                  </button>
                </form>
              </section>
            </>
          ) : (
            <p>Оберіть таблицю або створіть нову.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
