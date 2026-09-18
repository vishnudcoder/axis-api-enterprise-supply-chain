import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit,
  Eye,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type StockItem = {
  id: number;
  material_code: string;
  material_name: string;
  material_type: string;
  batch_number?: string | null;
  quantity: number;
  unit: string;
  warehouse?: string | null;
  location?: string | null;
  minimum_stock: number;
  reorder_level: number;
  status: string;
  expiry_date?: string | null;
  supplier?: string | null;
  last_received?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type StockForm = {
  material_code: string;
  material_name: string;
  material_type: string;
  batch_number: string;
  quantity: string;
  unit: string;
  warehouse: string;
  location: string;
  minimum_stock: string;
  reorder_level: string;
  status: string;
  expiry_date: string;
  supplier: string;
  last_received: string;
  notes: string;
};

const STOCK_STATUSES = [
  "Available",
  "Low Stock",
  "Out of Stock",
  "Reserved",
  "Blocked",
  "Expired",
];

const emptyForm: StockForm = {
  material_code: "",
  material_name: "",
  material_type: "",
  batch_number: "",
  quantity: "",
  unit: "kg",
  warehouse: "",
  location: "",
  minimum_stock: "0",
  reorder_level: "0",
  status: "Available",
  expiry_date: "",
  supplier: "",
  last_received: "",
  notes: "",
};

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function statusClass(status: string) {
  switch (status) {
    case "Available":
      return "stock-badge stock-green";
    case "Low Stock":
      return "stock-badge stock-yellow";
    case "Out of Stock":
      return "stock-badge stock-red";
    case "Reserved":
      return "stock-badge stock-blue";
    case "Blocked":
      return "stock-badge stock-red";
    case "Expired":
      return "stock-badge stock-red";
    default:
      return "stock-badge stock-gray";
  }
}

function payloadFromForm(form: StockForm) {
  return {
    material_code: form.material_code.trim(),
    material_name: form.material_name.trim(),
    material_type: form.material_type.trim(),
    batch_number: form.batch_number.trim() || null,
    quantity: Number(form.quantity || 0),
    unit: form.unit.trim() || "kg",
    warehouse: form.warehouse.trim() || null,
    location: form.location.trim() || null,
    minimum_stock: Number(form.minimum_stock || 0),
    reorder_level: Number(form.reorder_level || 0),
    status: form.status,
    expiry_date: form.expiry_date
      ? new Date(form.expiry_date).toISOString()
      : null,
    supplier: form.supplier.trim() || null,
    last_received: form.last_received
      ? new Date(form.last_received).toISOString()
      : null,
    notes: form.notes.trim() || null,
  };
}

export default function StockManagementPage() {
  const { user } = useAuth();

  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [warehouseFilter, setWarehouseFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingItem, setEditingItem] =
    useState<StockItem | null>(null);

  const [viewingItem, setViewingItem] =
    useState<StockItem | null>(null);

  const [form, setForm] = useState<StockForm>(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadStock = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/api/stock", {
        params: {
          page: 1,
          page_size: 100,
        },
      });

      setItems(response.data?.items || response.data || []);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to load stock data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const warehouses = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.warehouse)
          .filter(Boolean)
      )
    ) as string[];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !query ||
        item.material_code.toLowerCase().includes(query) ||
        item.material_name.toLowerCase().includes(query) ||
        item.material_type.toLowerCase().includes(query) ||
        String(item.batch_number || "")
          .toLowerCase()
          .includes(query) ||
        String(item.supplier || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      const matchesWarehouse =
        warehouseFilter === "All" ||
        item.warehouse === warehouseFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesWarehouse
      );
    });
  }, [
    items,
    search,
    statusFilter,
    warehouseFilter,
  ]);

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const lowStockCount = items.filter(
    (item) =>
      Number(item.quantity || 0) <=
        Number(item.reorder_level || 0) &&
      Number(item.quantity || 0) > 0
  ).length;

  const outOfStockCount = items.filter(
    (item) =>
      Number(item.quantity || 0) <= 0 ||
      item.status === "Out of Stock"
  ).length;

  const blockedCount = items.filter(
    (item) => item.status === "Blocked"
  ).length;

  const expiredCount = items.filter(
    (item) => item.status === "Expired"
  ).length;

  const updateField = (
    field: keyof StockForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (item: StockItem) => {
    setEditingItem(item);

    setForm({
      material_code: item.material_code || "",
      material_name: item.material_name || "",
      material_type: item.material_type || "",
      batch_number: item.batch_number || "",
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "kg",
      warehouse: item.warehouse || "",
      location: item.location || "",
      minimum_stock: String(
        item.minimum_stock ?? 0
      ),
      reorder_level: String(
        item.reorder_level ?? 0
      ),
      status: item.status || "Available",
      expiry_date: toDateInput(item.expiry_date),
      supplier: item.supplier || "",
      last_received: toDateInput(item.last_received),
      notes: item.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openView = (item: StockItem) => {
    setViewingItem(item);
    setShowView(true);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.material_code.trim()) {
      setError("Material code is required.");
      return;
    }

    if (!form.material_name.trim()) {
      setError("Material name is required.");
      return;
    }

    if (!form.material_type.trim()) {
      setError("Material type is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = payloadFromForm(form);

      if (editingItem) {
        await api.put(
          `/api/stock/${editingItem.id}`,
          payload
        );

        setSuccess(
          "Stock item updated successfully."
        );
      } else {
        await api.post("/api/stock", payload);

        setSuccess(
          "Stock item created successfully."
        );
      }

      setShowForm(false);
      setEditingItem(null);
      setForm(emptyForm);

      await loadStock();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to save stock item."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: StockItem) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Delete stock item "${item.material_code}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/api/stock/${item.id}`);

      setSuccess(
        "Stock item deleted successfully."
      );

      await loadStock();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to delete stock item."
      );
    }
  };

  const handleStatusChange = async (
    item: StockItem,
    status: string
  ) => {
    if (!isAdmin) return;

    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/api/stock/${item.id}/status`,
        { status }
      );

      setSuccess("Stock status updated.");

      await loadStock();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to update stock status."
      );
    }
  };

  return (
    <div className="stock-page">
      <style>{`
        .stock-page {
          padding: 24px;
          min-height: calc(100vh - 64px);
          background: #f7f8fa;
          color: #18212f;
        }

        .stock-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .stock-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .stock-subtitle {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .stock-actions {
          display: flex;
          gap: 10px;
        }

        .stock-button {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .stock-primary {
          background: #111827;
          color: white;
        }

        .stock-secondary {
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .stock-button:hover {
          transform: translateY(-1px);
        }

        .stock-kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stock-kpi {
          background: white;
          border: 1px solid #e7e9ed;
          border-radius: 12px;
          padding: 17px;
        }

        .stock-kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stock-kpi-label {
          color: #6b7280;
          font-size: 11px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: .4px;
        }

        .stock-kpi-value {
          margin-top: 9px;
          font-size: 24px;
          font-weight: 750;
        }

        .stock-kpi-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
        }

        .stock-toolbar {
          background: white;
          border: 1px solid #e7e9ed;
          border-radius: 12px 12px 0 0;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .stock-search {
          position: relative;
          min-width: 280px;
          max-width: 450px;
          flex: 1;
        }

        .stock-search svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .stock-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px 10px 37px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          outline: none;
          font-size: 13px;
        }

        .stock-filters {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .stock-select {
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          padding: 10px 30px 10px 10px;
          font-size: 13px;
          outline: none;
        }

        .stock-table-card {
          background: white;
          border: 1px solid #e7e9ed;
          border-top: 0;
          border-radius: 0 0 12px 12px;
          overflow: auto;
        }

        .stock-table {
          width: 100%;
          min-width: 1150px;
          border-collapse: collapse;
        }

        .stock-table th {
          text-align: left;
          padding: 13px 15px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .35px;
          white-space: nowrap;
        }

        .stock-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #f0f1f3;
          font-size: 13px;
          vertical-align: middle;
        }

        .stock-code {
          font-weight: 700;
          color: #111827;
        }

        .stock-name {
          font-weight: 600;
          margin-top: 3px;
        }

        .stock-muted {
          color: #6b7280;
        }

        .stock-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }

        .stock-green {
          background: #ecfdf3;
          color: #15803d;
        }

        .stock-yellow {
          background: #fffbeb;
          color: #b45309;
        }

        .stock-red {
          background: #fef2f2;
          color: #dc2626;
        }

        .stock-blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .stock-gray {
          background: #f3f4f6;
          color: #4b5563;
        }

        .stock-level {
          min-width: 115px;
        }

        .stock-level-top {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .stock-progress {
          height: 6px;
          background: #edf0f2;
          border-radius: 999px;
          overflow: hidden;
        }

        .stock-progress-bar {
          height: 100%;
          background: #374151;
          border-radius: 999px;
        }

        .stock-row-actions {
          display: flex;
          gap: 6px;
        }

        .stock-icon-button {
          width: 34px;
          height: 34px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 7px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .stock-empty,
        .stock-loading {
          padding: 55px 20px;
          text-align: center;
          color: #6b7280;
        }

        .stock-spin {
          animation: stock-spin 1s linear infinite;
        }

        @keyframes stock-spin {
          to { transform: rotate(360deg); }
        }

        .stock-alert {
          margin-bottom: 15px;
          padding: 11px 13px;
          border-radius: 8px;
          font-size: 13px;
        }

        .stock-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .stock-success {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #047857;
        }

        .stock-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .stock-modal {
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow: 0 25px 70px rgba(0,0,0,.18);
        }

        .stock-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          background: white;
          z-index: 2;
        }

        .stock-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .stock-close {
          width: 34px;
          height: 34px;
          border: 0;
          background: #f3f4f6;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stock-form {
          padding: 20px;
        }

        .stock-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .stock-full {
          grid-column: 1 / -1;
        }

        .stock-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .stock-field label {
          font-size: 12px;
          font-weight: 650;
          color: #374151;
        }

        .stock-input,
        .stock-textarea {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 11px;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          outline: none;
          font-size: 13px;
          background: white;
        }

        .stock-textarea {
          min-height: 85px;
          resize: vertical;
        }

        .stock-required {
          color: #dc2626;
        }

        .stock-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .stock-details {
          padding: 20px;
        }

        .stock-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .stock-detail {
          background: white;
          padding: 13px;
        }

        .stock-detail-label {
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .3px;
          margin-bottom: 5px;
        }

        .stock-detail-value {
          font-size: 13px;
          font-weight: 600;
          word-break: break-word;
        }

        .stock-notes {
          margin-top: 15px;
          padding: 13px;
          background: #f9fafb;
          border-radius: 9px;
        }

        @media (max-width: 1100px) {
          .stock-kpis {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .stock-page {
            padding: 15px;
          }

          .stock-header {
            flex-direction: column;
          }

          .stock-actions {
            width: 100%;
          }

          .stock-actions .stock-button {
            flex: 1;
          }

          .stock-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stock-search {
            min-width: 100%;
            max-width: none;
          }

          .stock-filters {
            width: 100%;
          }

          .stock-filters .stock-select {
            flex: 1;
          }

          .stock-form-grid,
          .stock-detail-grid {
            grid-template-columns: 1fr;
          }

          .stock-full {
            grid-column: auto;
          }
        }

        @media (max-width: 450px) {
          .stock-kpis {
            grid-template-columns: 1fr;
          }

          .stock-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="stock-header">
        <div>
          <h1 className="stock-title">
            Stock Management
          </h1>

          <p className="stock-subtitle">
            Monitor raw materials, inventory levels,
            warehouses and stock alerts.
          </p>
        </div>

        <div className="stock-actions">
          <button
            className="stock-button stock-secondary"
            onClick={loadStock}
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          {isAdmin && (
            <button
              className="stock-button stock-primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              Add Stock
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="stock-alert stock-error">
          {error}
        </div>
      )}

      {success && (
        <div className="stock-alert stock-success">
          {success}
        </div>
      )}

      <div className="stock-kpis">
        <div className="stock-kpi">
          <div className="stock-kpi-top">
            <div>
              <div className="stock-kpi-label">
                Total Items
              </div>

              <div className="stock-kpi-value">
                {items.length}
              </div>
            </div>

            <div className="stock-kpi-icon">
              <Package size={18} />
            </div>
          </div>
        </div>

        <div className="stock-kpi">
          <div className="stock-kpi-top">
            <div>
              <div className="stock-kpi-label">
                Total Quantity
              </div>

              <div className="stock-kpi-value">
                {formatNumber(totalQuantity)}
              </div>
            </div>

            <div className="stock-kpi-icon">
              <Package size={18} />
            </div>
          </div>
        </div>

        <div className="stock-kpi">
          <div className="stock-kpi-top">
            <div>
              <div className="stock-kpi-label">
                Low Stock
              </div>

              <div className="stock-kpi-value">
                {lowStockCount}
              </div>
            </div>

            <div className="stock-kpi-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

        <div className="stock-kpi">
          <div className="stock-kpi-top">
            <div>
              <div className="stock-kpi-label">
                Out of Stock
              </div>

              <div className="stock-kpi-value">
                {outOfStockCount}
              </div>
            </div>

            <div className="stock-kpi-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

        <div className="stock-kpi">
          <div className="stock-kpi-top">
            <div>
              <div className="stock-kpi-label">
                Expired
              </div>

              <div className="stock-kpi-value">
                {expiredCount}
              </div>
            </div>

            <div className="stock-kpi-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="stock-toolbar">
        <div className="stock-search">
          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search material, code, batch, supplier..."
          />
        </div>

        <div className="stock-filters">
          <select
            className="stock-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All Statuses</option>

            {STOCK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="stock-select"
            value={warehouseFilter}
            onChange={(event) =>
              setWarehouseFilter(event.target.value)
            }
          >
            <option value="All">All Warehouses</option>

            {warehouses.map((warehouse) => (
              <option
                key={warehouse}
                value={warehouse}
              >
                {warehouse}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stock-table-card">
        {loading ? (
          <div className="stock-loading">
            <Loader2
              size={28}
              className="stock-spin"
            />

            <div style={{ marginTop: 10 }}>
              Loading stock...
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="stock-empty">
            <Package
              size={34}
              style={{
                opacity: 0.5,
                marginBottom: 10,
              }}
            />

            <div style={{ fontWeight: 650 }}>
              No stock items found
            </div>

            <div style={{ marginTop: 5 }}>
              Add stock or change the filters.
            </div>
          </div>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Type</th>
                <th>Batch</th>
                <th>Quantity</th>
                <th>Stock Level</th>
                <th>Status</th>
                <th>Warehouse</th>
                <th>Location</th>
                <th>Expiry</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => {
                const quantity = Number(
                  item.quantity || 0
                );

                const reorder = Number(
                  item.reorder_level || 0
                );

                const percentage =
                  reorder > 0
                    ? Math.min(
                        100,
                        (quantity / reorder) * 100
                      )
                    : quantity > 0
                    ? 100
                    : 0;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="stock-code">
                        {item.material_code}
                      </div>

                      <div className="stock-name">
                        {item.material_name}
                      </div>
                    </td>

                    <td>{item.material_type}</td>

                    <td>
                      {item.batch_number || "—"}
                    </td>

                    <td>
                      <strong>
                        {formatNumber(quantity)}
                      </strong>{" "}
                      {item.unit}
                    </td>

                    <td>
                      <div className="stock-level">
                        <div className="stock-level-top">
                          <span>
                            Reorder:{" "}
                            {formatNumber(reorder)}
                          </span>
                        </div>

                        <div className="stock-progress">
                          <div
                            className="stock-progress-bar"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      {isAdmin ? (
                        <select
                          className="stock-select"
                          style={{
                            padding:
                              "6px 25px 6px 7px",
                            fontSize: 11,
                          }}
                          value={item.status}
                          onChange={(event) =>
                            handleStatusChange(
                              item,
                              event.target.value
                            )
                          }
                        >
                          {STOCK_STATUSES.map(
                            (status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <span
                          className={statusClass(
                            item.status
                          )}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>

                    <td>
                      {item.warehouse || "—"}
                    </td>

                    <td>
                      {item.location || "—"}
                    </td>

                    <td>
                      {formatDate(item.expiry_date)}
                    </td>

                    <td>
                      {item.supplier || "—"}
                    </td>

                    <td>
                      <div className="stock-row-actions">
                        <button
                          className="stock-icon-button"
                          title="View"
                          onClick={() =>
                            openView(item)
                          }
                        >
                          <Eye size={15} />
                        </button>

                        {isAdmin && (
                          <>
                            <button
                              className="stock-icon-button"
                              title="Edit"
                              onClick={() =>
                                openEdit(item)
                              }
                            >
                              <Edit size={15} />
                            </button>

                            <button
                              className="stock-icon-button"
                              title="Delete"
                              onClick={() =>
                                handleDelete(item)
                              }
                            >
                              <Trash2
                                size={15}
                                color="#dc2626"
                              />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          className="stock-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowForm(false);
            }
          }}
        >
          <div className="stock-modal">
            <div className="stock-modal-header">
              <h2 className="stock-modal-title">
                {editingItem
                  ? "Edit Stock Item"
                  : "Add Stock Item"}
              </h2>

              <button
                className="stock-close"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="stock-form"
              onSubmit={handleSubmit}
            >
              <div className="stock-form-grid">
                <div className="stock-field">
                  <label>
                    Material Code{" "}
                    <span className="stock-required">
                      *
                    </span>
                  </label>

                  <input
                    className="stock-input"
                    value={form.material_code}
                    onChange={(event) =>
                      updateField(
                        "material_code",
                        event.target.value
                      )
                    }
                    placeholder="RM-001"
                    required
                  />
                </div>

                <div className="stock-field">
                  <label>
                    Material Name{" "}
                    <span className="stock-required">
                      *
                    </span>
                  </label>

                  <input
                    className="stock-input"
                    value={form.material_name}
                    onChange={(event) =>
                      updateField(
                        "material_name",
                        event.target.value
                      )
                    }
                    placeholder="Paracetamol API"
                    required
                  />
                </div>

                <div className="stock-field">
                  <label>
                    Material Type{" "}
                    <span className="stock-required">
                      *
                    </span>
                  </label>

                  <input
                    className="stock-input"
                    value={form.material_type}
                    onChange={(event) =>
                      updateField(
                        "material_type",
                        event.target.value
                      )
                    }
                    placeholder="Raw Material"
                    required
                  />
                </div>

                <div className="stock-field">
                  <label>Batch Number</label>

                  <input
                    className="stock-input"
                    value={form.batch_number}
                    onChange={(event) =>
                      updateField(
                        "batch_number",
                        event.target.value
                      )
                    }
                    placeholder="BATCH-001"
                  />
                </div>

                <div className="stock-field">
                  <label>Quantity</label>

                  <input
                    className="stock-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    onChange={(event) =>
                      updateField(
                        "quantity",
                        event.target.value
                      )
                    }
                    placeholder="1000"
                  />
                </div>

                <div className="stock-field">
                  <label>Unit</label>

                  <input
                    className="stock-input"
                    value={form.unit}
                    onChange={(event) =>
                      updateField(
                        "unit",
                        event.target.value
                      )
                    }
                    placeholder="kg"
                  />
                </div>

                <div className="stock-field">
                  <label>Warehouse</label>

                  <input
                    className="stock-input"
                    value={form.warehouse}
                    onChange={(event) =>
                      updateField(
                        "warehouse",
                        event.target.value
                      )
                    }
                    placeholder="Main Warehouse"
                  />
                </div>

                <div className="stock-field">
                  <label>Location</label>

                  <input
                    className="stock-input"
                    value={form.location}
                    onChange={(event) =>
                      updateField(
                        "location",
                        event.target.value
                      )
                    }
                    placeholder="Rack A-01"
                  />
                </div>

                <div className="stock-field">
                  <label>Minimum Stock</label>

                  <input
                    className="stock-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minimum_stock}
                    onChange={(event) =>
                      updateField(
                        "minimum_stock",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="stock-field">
                  <label>Reorder Level</label>

                  <input
                    className="stock-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.reorder_level}
                    onChange={(event) =>
                      updateField(
                        "reorder_level",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="stock-field">
                  <label>Status</label>

                  <select
                    className="stock-input"
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                  >
                    {STOCK_STATUSES.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="stock-field">
                  <label>Expiry Date</label>

                  <input
                    className="stock-input"
                    type="date"
                    value={form.expiry_date}
                    onChange={(event) =>
                      updateField(
                        "expiry_date",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="stock-field">
                  <label>Supplier</label>

                  <input
                    className="stock-input"
                    value={form.supplier}
                    onChange={(event) =>
                      updateField(
                        "supplier",
                        event.target.value
                      )
                    }
                    placeholder="Supplier name"
                  />
                </div>

                <div className="stock-field">
                  <label>Last Received</label>

                  <input
                    className="stock-input"
                    type="date"
                    value={form.last_received}
                    onChange={(event) =>
                      updateField(
                        "last_received",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="stock-field stock-full">
                  <label>Notes</label>

                  <textarea
                    className="stock-textarea"
                    value={form.notes}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="Additional stock notes..."
                  />
                </div>
              </div>

              {error && (
                <div
                  className="stock-alert stock-error"
                  style={{
                    marginTop: 15,
                    marginBottom: 0,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="stock-modal-footer">
                <button
                  type="button"
                  className="stock-button stock-secondary"
                  onClick={() =>
                    setShowForm(false)
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="stock-button stock-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={15}
                        className="stock-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      {editingItem
                        ? "Update Stock"
                        : "Create Stock"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showView && viewingItem && (
        <div
          className="stock-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowView(false);
            }
          }}
        >
          <div className="stock-modal">
            <div className="stock-modal-header">
              <div>
                <h2 className="stock-modal-title">
                  {viewingItem.material_name}
                </h2>

                <div
                  className="stock-muted"
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                  }}
                >
                  {viewingItem.material_code}
                </div>
              </div>

              <button
                className="stock-close"
                onClick={() =>
                  setShowView(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="stock-details">
              <div className="stock-detail-grid">
                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Material Code
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.material_code}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Material Name
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.material_name}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Material Type
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.material_type}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Batch Number
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.batch_number || "—"}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Quantity
                  </div>

                  <div className="stock-detail-value">
                    {formatNumber(
                      viewingItem.quantity
                    )}{" "}
                    {viewingItem.unit}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Status
                  </div>

                  <div className="stock-detail-value">
                    <span
                      className={statusClass(
                        viewingItem.status
                      )}
                    >
                      {viewingItem.status}
                    </span>
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Minimum Stock
                  </div>

                  <div className="stock-detail-value">
                    {formatNumber(
                      viewingItem.minimum_stock
                    )}{" "}
                    {viewingItem.unit}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Reorder Level
                  </div>

                  <div className="stock-detail-value">
                    {formatNumber(
                      viewingItem.reorder_level
                    )}{" "}
                    {viewingItem.unit}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Warehouse
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.warehouse || "—"}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Location
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.location || "—"}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Expiry Date
                  </div>

                  <div className="stock-detail-value">
                    {formatDate(
                      viewingItem.expiry_date
                    )}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Supplier
                  </div>

                  <div className="stock-detail-value">
                    {viewingItem.supplier || "—"}
                  </div>
                </div>

                <div className="stock-detail">
                  <div className="stock-detail-label">
                    Last Received
                  </div>

                  <div className="stock-detail-value">
                    {formatDate(
                      viewingItem.last_received
                    )}
                  </div>
                </div>
              </div>

              {viewingItem.notes && (
                <div className="stock-notes">
                  <div className="stock-detail-label">
                    Notes
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {viewingItem.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="stock-modal-footer">
              <button
                className="stock-button stock-secondary"
                onClick={() =>
                  setShowView(false)
                }
              >
                Close
              </button>

              {isAdmin && (
                <button
                  className="stock-button stock-primary"
                  onClick={() => {
                    setShowView(false);
                    openEdit(viewingItem);
                  }}
                >
                  <Edit size={15} />
                  Edit Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}