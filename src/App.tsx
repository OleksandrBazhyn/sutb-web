import { useEffect, useState, type FormEvent } from "react";
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

  const [newTableName, setNewTableName] = useState("");
  const [newFields, setNewFields] = useState<NewFieldState[]>([
    { name: "", type: "string", isRequired: false, maxLength: "", enumValues: "" },
  ]);

  const [newRecord, setNewRecord] = useState<Record<string, string>>({});

  const [filterField, setFilterField] = useState("");
  const [filterOperator, setFilterOperator] = useState("=");
  const [filterValue, setFilterValue] = useState("");

  const [sortField, setSortField] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const handleError = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  };

  const reloadTables = async () => {
    try {
      setError(null);
      const list = await getTables();
      setTables(list);
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
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTable) loadTableData(selectedTable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable]);

  const handleAddFieldRow = () => {
    setNewFields(prev => [
      ...prev,
      { name: "", type: "string", isRequired: false, maxLength: "", enumValues: "" },
    ]);
  };

  const handleFieldChange = (i: number, patch: Partial<NewFieldState>) => {
    setNewFields(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const handleCreateTable = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      setError("Назва таблиці обов’язкова.");
      return;
    }

    try {
      setLoading(true);

      const fieldsPayload = newFields
        .filter(f => f.name.trim())
        .map(f => ({
          name: f.name.trim(),
          type: f.type,
          isRequired: f.isRequired,
          maxLength: f.maxLength ? Number(f.maxLength) : undefined,
          enumValues:
            f.type === "enum"
              ? f.enumValues
                  .split("\n")
                  .map(x => x.trim())
                  .filter(Boolean)
              : undefined,
        }));

      if (fieldsPayload.length === 0) {
        setError("Додайте хоча б одне поле.");
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

  const handleNewRecordChange = (fieldName: string, value: string) => {
    setNewRecord(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleAddRecord = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    try {
      setLoading(true);
      await addRecord(selectedTable, newRecord);
      setNewRecord({});
      await loadTableData(selectedTable);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = async () => {
    if (!selectedTable || !sortField) return;
    try {
      setLoading(true);
      await sortTable(selectedTable, sortField, sortAsc);
      await loadTableData(selectedTable);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    if (!selectedTable || !filterField || !filterOperator) return;

    try {
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
    if (selectedTable) loadTableData(selectedTable);
  };

  const handleSaveDb = async () => {
    try {
      setLoading(true);
      await saveDatabase();
      alert("Базу збережено на сервер.");
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDb = async () => {
    try {
      setLoading(true);
      const list = await loadDatabase();
      setTables(list);
      if (list.length > 0) setSelectedTable(list[0]);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>SUTB – Web Client</h1>

        <div className="db-buttons">
          <button onClick={handleSaveDb} disabled={loading}>
            Зберегти на сервер
          </button>

          <button onClick={handleLoadDb} disabled={loading}>
    Завантажити з сервера
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

          <label className="upload-btn">
            Імпорт БД
            <input
              type="file"
              accept="application/json"
              className="upload-input"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                  const text = await file.text();
                  const json = JSON.parse(text);

                  await importDatabase(json);
                  await reloadTables();

                  alert("БД імпортовано");
                } catch {
                  alert("Некоректний JSON-файл");
                }
              }}
            />
          </label>
        </div>
      </header>

      {error && <div className="error">Помилка: {error}</div>}
      {loading && <div className="loading">Завантаження...</div>}

      <div className="layout">
        <aside className="sidebar">
          <section>
            <h2>Таблиці</h2>
            <ul className="table-list">
              {tables.map(t => (
                <li
                  key={t}
                  onClick={() => setSelectedTable(t)}
                  className={t === selectedTable ? "selected" : ""}
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
                <input value={newTableName} onChange={e => setNewTableName(e.target.value)} />
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
                      rows={3}
                      value={f.enumValues}
                      placeholder="кожне значення з нового рядка"
                      style={{ resize: "vertical" }}
                      onChange={e => handleFieldChange(idx, { enumValues: e.target.value })}
                    />
                  )}
                </div>
              ))}

              <button type="button" onClick={handleAddFieldRow}>
                + поле
              </button>
              <button type="submit">Створити</button>
            </form>
          </section>
        </aside>

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
                      <th>Enum</th>
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
                <h3>Фільтрація</h3>
                <div className="filter-row">
                  <select value={filterField} onChange={e => setFilterField(e.target.value)}>
                    <option value="">Поле…</option>
                    {schema.map(f => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)}>
                    {FILTER_OPERATORS.map(op => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>

                  <input
                    placeholder="значення"
                    value={filterValue}
                    onChange={e => setFilterValue(e.target.value)}
                  />

                  <button onClick={handleFilter}>Застосувати</button>
                  <button onClick={handleResetFilter}>Скинути</button>
                </div>
              </section>

              <section className="block">
                <h3>Сортування</h3>
                <div className="filter-row">
                  <select value={sortField} onChange={e => setSortField(e.target.value)}>
                    <option value="">Поле…</option>
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

                  <button onClick={handleSort}>Відсортувати</button>
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
                          <td key={f.name}>{String(r.data[f.name] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={schema.length + 1}>(Немає записів)</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="block">
                <h3>Додати запис</h3>
                <form onSubmit={handleAddRecord} className="record-form">
                  {schema.map(f => (
                    <div className="record-field" key={f.name}>
                      <label>
                        {f.name} ({f.type}
                        {f.isRequired ? "*" : ""})
                      </label>

                      {f.type === "enum" ? (
                        <select
                          value={newRecord[f.name] ?? ""}
                          onChange={e => handleNewRecordChange(f.name, e.target.value)}
                        >
                          <option value="">(оберіть)</option>
                          {f.enumValues?.map(v => (
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
                  <button type="submit">Додати</button>
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
