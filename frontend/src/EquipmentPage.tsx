import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Edit,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type Equipment = {
  id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  location?: string | null;
  capacity: number;
  capacity_unit: string;
  status: string;
  maintenance_status: string;
  last_maintenance?: string | null;
  next_maintenance?: string | null;
  utilization_percent: number;
  assigned_reactor?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type EquipmentForm = {
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  location: string;
  capacity: string;
  capacity_unit: string;
  status: string;
  maintenance_status: string;
  last_maintenance: string;
  next_maintenance: string;
  utilization_percent: string;
  assigned_reactor: string;
  manufacturer: string;
  serial_number: string;
  notes: string;
};

const EQUIPMENT_STATUSES = [
  "Operational",
  "Standby",
  "Under Maintenance",
  "Breakdown",
  "Offline",
];

const MAINTENANCE_STATUSES = [
  "Up to Date",
  "Due Soon",
  "Overdue",
  "In Progress",
];

const emptyForm: EquipmentForm = {
  equipment_code: "",
  equipment_name: "",
  equipment_type: "",
  location: "",
  capacity: "",
  capacity_unit: "kg",
  status: "Operational",
  maintenance_status: "Up to Date",
  last_maintenance: "",
  next_maintenance: "",
  utilization_percent: "0",
  assigned_reactor: "",
  manufacturer: "",
  serial_number: "",
  notes: "",
};

function formatNumber(value: number | string | null | undefined) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusClass(status: string) {
  switch (status) {
    case "Operational":
      return "eq-badge eq-green";

    case "Standby":
      return "eq-badge eq-blue";

    case "Under Maintenance":
      return "eq-badge eq-yellow";

    case "Breakdown":
      return "eq-badge eq-red";

    case "Offline":
      return "eq-badge eq-gray";

    default:
      return "eq-badge eq-gray";
  }
}

function maintenanceClass(status: string) {
  switch (status) {
    case "Up to Date":
      return "eq-badge eq-green";

    case "Due Soon":
      return "eq-badge eq-yellow";

    case "Overdue":
      return "eq-badge eq-red";

    case "In Progress":
      return "eq-badge eq-blue";

    default:
      return "eq-badge eq-gray";
  }
}

function createPayload(form: EquipmentForm) {
  return {
    equipment_code: form.equipment_code.trim(),
    equipment_name: form.equipment_name.trim(),
    equipment_type: form.equipment_type.trim(),
    location: form.location.trim() || null,
    capacity: Number(form.capacity || 0),
    capacity_unit: form.capacity_unit.trim() || "kg",
    status: form.status,
    maintenance_status: form.maintenance_status,
    last_maintenance: form.last_maintenance
      ? new Date(form.last_maintenance).toISOString()
      : null,
    next_maintenance: form.next_maintenance
      ? new Date(form.next_maintenance).toISOString()
      : null,
    utilization_percent: Number(form.utilization_percent || 0),
    assigned_reactor: form.assigned_reactor.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    serial_number: form.serial_number.trim() || null,
    notes: form.notes.trim() || null,
  };
}

export default function EquipmentPage() {
  const { user } = useAuth();

  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [maintenanceFilter, setMaintenanceFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingEquipment, setEditingEquipment] =
    useState<Equipment | null>(null);

  const [viewingEquipment, setViewingEquipment] =
    useState<Equipment | null>(null);

  const [form, setForm] = useState<EquipmentForm>(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadEquipment = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/api/equipment", {
        params: {
          page: 1,
          page_size: 100,
        },
      });

      const data = response.data;

      setEquipment(data?.items || data || []);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to load equipment data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  const filteredEquipment = useMemo(() => {
    const query = search.trim().toLowerCase();

    return equipment.filter((item) => {
      const matchesSearch =
        !query ||
        item.equipment_code.toLowerCase().includes(query) ||
        item.equipment_name.toLowerCase().includes(query) ||
        item.equipment_type.toLowerCase().includes(query) ||
        String(item.location || "")
          .toLowerCase()
          .includes(query) ||
        String(item.assigned_reactor || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      const matchesMaintenance =
        maintenanceFilter === "All" ||
        item.maintenance_status === maintenanceFilter;

      return matchesSearch && matchesStatus && matchesMaintenance;
    });
  }, [
    equipment,
    search,
    statusFilter,
    maintenanceFilter,
  ]);

  const totalEquipment = equipment.length;

  const operationalEquipment = equipment.filter(
    (item) => item.status === "Operational"
  ).length;

  const maintenanceEquipment = equipment.filter(
    (item) =>
      item.status === "Under Maintenance" ||
      item.status === "Breakdown"
  ).length;

  const overdueEquipment = equipment.filter(
    (item) => item.maintenance_status === "Overdue"
  ).length;

  const averageUtilization =
    equipment.length > 0
      ? equipment.reduce(
          (sum, item) => sum + Number(item.utilization_percent || 0),
          0
        ) / equipment.length
      : 0;

  const openCreate = () => {
    setEditingEquipment(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openEdit = (item: Equipment) => {
    setEditingEquipment(item);

    setForm({
      equipment_code: item.equipment_code || "",
      equipment_name: item.equipment_name || "",
      equipment_type: item.equipment_type || "",
      location: item.location || "",
      capacity: String(item.capacity ?? ""),
      capacity_unit: item.capacity_unit || "kg",
      status: item.status || "Operational",
      maintenance_status:
        item.maintenance_status || "Up to Date",
      last_maintenance: toDateTimeLocal(item.last_maintenance),
      next_maintenance: toDateTimeLocal(item.next_maintenance),
      utilization_percent: String(
        item.utilization_percent ?? 0
      ),
      assigned_reactor: item.assigned_reactor || "",
      manufacturer: item.manufacturer || "",
      serial_number: item.serial_number || "",
      notes: item.notes || "",
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  };

  const openView = (item: Equipment) => {
    setViewingEquipment(item);
    setShowView(true);
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.equipment_code.trim()) {
      setError("Equipment code is required.");
      return;
    }

    if (!form.equipment_name.trim()) {
      setError("Equipment name is required.");
      return;
    }

    if (!form.equipment_type.trim()) {
      setError("Equipment type is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = createPayload(form);

      if (editingEquipment) {
        await api.put(
          `/api/equipment/${editingEquipment.id}`,
          payload
        );

        setSuccess("Equipment updated successfully.");
      } else {
        await api.post("/api/equipment", payload);

        setSuccess("Equipment created successfully.");
      }

      setShowForm(false);
      setEditingEquipment(null);
      setForm(emptyForm);

      await loadEquipment();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to save equipment."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Equipment) => {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Delete equipment "${item.equipment_code}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/api/equipment/${item.id}`);

      setSuccess("Equipment deleted successfully.");

      await loadEquipment();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to delete equipment."
      );
    }
  };

  const handleStatusChange = async (
    item: Equipment,
    status: string
  ) => {
    if (!isAdmin) return;

    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/api/equipment/${item.id}/status`,
        {
          status,
        }
      );

      setSuccess("Equipment status updated.");

      await loadEquipment();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to update equipment status."
      );
    }
  };

  const updateField = (
    field: keyof EquipmentForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  return (
    <div className="equipment-page">
      <style>{`
        .equipment-page {
          padding: 24px;
          background: #f7f8fa;
          min-height: calc(100vh - 64px);
          color: #18212f;
        }

        .equipment-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .equipment-title {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .equipment-subtitle {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .equipment-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .eq-button {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: 0.15s ease;
        }

        .eq-button:hover {
          transform: translateY(-1px);
        }

        .eq-primary {
          background: #111827;
          color: white;
        }

        .eq-secondary {
          background: white;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .eq-danger {
          background: #fff1f2;
          color: #dc2626;
        }

        .eq-icon-button {
          width: 34px;
          height: 34px;
          padding: 0;
          border-radius: 7px;
          border: 1px solid #e5e7eb;
          background: white;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .eq-icon-button:hover {
          background: #f3f4f6;
        }

        .eq-kpis {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .eq-kpi {
          background: white;
          border: 1px solid #e7e9ed;
          border-radius: 12px;
          padding: 17px;
          min-width: 0;
        }

        .eq-kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .eq-kpi-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .eq-kpi-value {
          margin-top: 9px;
          font-size: 25px;
          line-height: 1;
          font-weight: 750;
        }

        .eq-kpi-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
        }

        .eq-toolbar {
          background: white;
          border: 1px solid #e7e9ed;
          border-radius: 12px 12px 0 0;
          padding: 14px;
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .eq-search {
          position: relative;
          min-width: 260px;
          flex: 1;
          max-width: 430px;
        }

        .eq-search svg {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .eq-search input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px 10px 37px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          outline: none;
          font-size: 13px;
          background: white;
        }

        .eq-search input:focus,
        .eq-select:focus,
        .eq-input:focus,
        .eq-textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.08);
        }

        .eq-filters {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .eq-select {
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          padding: 10px 32px 10px 11px;
          outline: none;
          font-size: 13px;
          color: #374151;
        }

        .eq-table-card {
          background: white;
          border: 1px solid #e7e9ed;
          border-top: 0;
          border-radius: 0 0 12px 12px;
          overflow: auto;
        }

        .eq-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        .eq-table th {
          text-align: left;
          padding: 13px 15px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.35px;
          white-space: nowrap;
        }

        .eq-table td {
          padding: 14px 15px;
          border-bottom: 1px solid #f0f1f3;
          font-size: 13px;
          vertical-align: middle;
        }

        .eq-table tr:last-child td {
          border-bottom: 0;
        }

        .eq-code {
          font-weight: 700;
          color: #111827;
        }

        .eq-name {
          font-weight: 600;
        }

        .eq-muted {
          color: #6b7280;
        }

        .eq-badge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 650;
          white-space: nowrap;
        }

        .eq-green {
          background: #ecfdf3;
          color: #15803d;
        }

        .eq-blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .eq-yellow {
          background: #fffbeb;
          color: #b45309;
        }

        .eq-red {
          background: #fef2f2;
          color: #dc2626;
        }

        .eq-gray {
          background: #f3f4f6;
          color: #4b5563;
        }

        .eq-util {
          min-width: 105px;
        }

        .eq-util-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .eq-progress {
          height: 6px;
          background: #edf0f2;
          border-radius: 999px;
          overflow: hidden;
        }

        .eq-progress-bar {
          height: 100%;
          background: #374151;
          border-radius: 999px;
        }

        .eq-row-actions {
          display: flex;
          gap: 6px;
        }

        .eq-empty,
        .eq-loading {
          padding: 55px 20px;
          text-align: center;
          color: #6b7280;
        }

        .eq-loading-spinner {
          animation: eq-spin 1s linear infinite;
        }

        @keyframes eq-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .eq-alert {
          margin-bottom: 15px;
          padding: 11px 13px;
          border-radius: 8px;
          font-size: 13px;
        }

        .eq-error {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }

        .eq-success {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .eq-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .eq-modal {
          background: white;
          width: min(900px, 100%);
          max-height: 92vh;
          overflow-y: auto;
          border-radius: 14px;
          box-shadow: 0 25px 70px rgba(0,0,0,0.18);
        }

        .eq-small-modal {
          width: min(650px, 100%);
        }

        .eq-modal-header {
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

        .eq-modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }

        .eq-modal-close {
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

        .eq-form {
          padding: 20px;
        }

        .eq-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .eq-form-full {
          grid-column: 1 / -1;
        }

        .eq-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .eq-field label {
          font-size: 12px;
          font-weight: 650;
          color: #374151;
        }

        .eq-input,
        .eq-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          padding: 10px 11px;
          outline: none;
          font-size: 13px;
          background: white;
        }

        .eq-textarea {
          min-height: 85px;
          resize: vertical;
        }

        .eq-required {
          color: #dc2626;
        }

        .eq-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 15px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .eq-details {
          padding: 20px;
        }

        .eq-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: #e5e7eb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .eq-detail-item {
          background: white;
          padding: 13px;
        }

        .eq-detail-label {
          font-size: 11px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 5px;
        }

        .eq-detail-value {
          font-size: 13px;
          font-weight: 600;
          word-break: break-word;
        }

        .eq-notes {
          margin-top: 15px;
          padding: 13px;
          background: #f9fafb;
          border-radius: 9px;
        }

        @media (max-width: 1100px) {
          .eq-kpis {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .equipment-page {
            padding: 15px;
          }

          .equipment-header {
            flex-direction: column;
          }

          .equipment-actions {
            width: 100%;
          }

          .equipment-actions .eq-button {
            flex: 1;
          }

          .eq-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .eq-toolbar {
            align-items: stretch;
          }

          .eq-search {
            min-width: 100%;
            max-width: none;
          }

          .eq-filters {
            width: 100%;
          }

          .eq-filters .eq-select {
            flex: 1;
            min-width: 0;
          }

          .eq-form-grid,
          .eq-detail-grid {
            grid-template-columns: 1fr;
          }

          .eq-form-full {
            grid-column: auto;
          }
        }

        @media (max-width: 450px) {
          .eq-kpis {
            grid-template-columns: 1fr;
          }

          .equipment-title {
            font-size: 23px;
          }
        }
      `}</style>

      <div className="equipment-header">
        <div>
          <h1 className="equipment-title">
            Equipment & Utilities
          </h1>

          <p className="equipment-subtitle">
            Monitor plant equipment, utilization and maintenance status.
          </p>
        </div>

        <div className="equipment-actions">
          <button
            className="eq-button eq-secondary"
            onClick={loadEquipment}
            title="Refresh equipment"
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          {isAdmin && (
            <button
              className="eq-button eq-primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="eq-alert eq-error">
          {error}
        </div>
      )}

      {success && (
        <div className="eq-alert eq-success">
          {success}
        </div>
      )}

      <div className="eq-kpis">
        <div className="eq-kpi">
          <div className="eq-kpi-top">
            <div>
              <div className="eq-kpi-label">
                Total Equipment
              </div>

              <div className="eq-kpi-value">
                {totalEquipment}
              </div>
            </div>

            <div className="eq-kpi-icon">
              <Settings size={18} />
            </div>
          </div>
        </div>

        <div className="eq-kpi">
          <div className="eq-kpi-top">
            <div>
              <div className="eq-kpi-label">
                Operational
              </div>

              <div className="eq-kpi-value">
                {operationalEquipment}
              </div>
            </div>

            <div className="eq-kpi-icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        <div className="eq-kpi">
          <div className="eq-kpi-top">
            <div>
              <div className="eq-kpi-label">
                Maintenance / Breakdown
              </div>

              <div className="eq-kpi-value">
                {maintenanceEquipment}
              </div>
            </div>

            <div className="eq-kpi-icon">
              <Wrench size={18} />
            </div>
          </div>
        </div>

        <div className="eq-kpi">
          <div className="eq-kpi-top">
            <div>
              <div className="eq-kpi-label">
                Maintenance Overdue
              </div>

              <div className="eq-kpi-value">
                {overdueEquipment}
              </div>
            </div>

            <div className="eq-kpi-icon">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>

        <div className="eq-kpi">
          <div className="eq-kpi-top">
            <div>
              <div className="eq-kpi-label">
                Avg Utilization
              </div>

              <div className="eq-kpi-value">
                {averageUtilization.toFixed(1)}%
              </div>
            </div>

            <div className="eq-kpi-icon">
              <Activity size={18} />
            </div>
          </div>
        </div>
      </div>

      <div className="eq-toolbar">
        <div className="eq-search">
          <Search size={16} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search equipment, code, type, location..."
          />
        </div>

        <div className="eq-filters">
          <select
            className="eq-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All Statuses</option>

            {EQUIPMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="eq-select"
            value={maintenanceFilter}
            onChange={(event) =>
              setMaintenanceFilter(event.target.value)
            }
          >
            <option value="All">All Maintenance</option>

            {MAINTENANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="eq-table-card">
        {loading ? (
          <div className="eq-loading">
            <Loader2
              className="eq-loading-spinner"
              size={28}
            />

            <div style={{ marginTop: 10 }}>
              Loading equipment...
            </div>
          </div>
        ) : filteredEquipment.length === 0 ? (
          <div className="eq-empty">
            <Settings
              size={32}
              style={{ marginBottom: 10, opacity: 0.5 }}
            />

            <div style={{ fontWeight: 650 }}>
              No equipment found
            </div>

            <div style={{ marginTop: 5 }}>
              Try changing the search or filters.
            </div>
          </div>
        ) : (
          <table className="eq-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Maintenance</th>
                <th>Utilization</th>
                <th>Reactor</th>
                <th>Location</th>
                <th>Next Maintenance</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEquipment.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="eq-code">
                      {item.equipment_code}
                    </div>

                    <div
                      className="eq-name"
                      style={{ marginTop: 3 }}
                    >
                      {item.equipment_name}
                    </div>
                  </td>

                  <td>{item.equipment_type}</td>

                  <td>
                    {formatNumber(item.capacity)}{" "}
                    {item.capacity_unit}
                  </td>

                  <td>
                    {isAdmin ? (
                      <select
                        className="eq-select"
                        style={{
                          padding: "6px 25px 6px 7px",
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
                        {EQUIPMENT_STATUSES.map(
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
                      <span className={statusClass(item.status)}>
                        {item.status}
                      </span>
                    )}
                  </td>

                  <td>
                    <span
                      className={maintenanceClass(
                        item.maintenance_status
                      )}
                    >
                      {item.maintenance_status}
                    </span>
                  </td>

                  <td>
                    <div className="eq-util">
                      <div className="eq-util-top">
                        <span>
                          {Number(
                            item.utilization_percent || 0
                          ).toFixed(1)}
                          %
                        </span>
                      </div>

                      <div className="eq-progress">
                        <div
                          className="eq-progress-bar"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                Number(
                                  item.utilization_percent || 0
                                )
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td>
                    {item.assigned_reactor || "—"}
                  </td>

                  <td>
                    {item.location || "—"}
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Clock3
                        size={13}
                        className="eq-muted"
                      />

                      {formatDate(item.next_maintenance)}
                    </div>
                  </td>

                  <td>
                    <div className="eq-row-actions">
                      <button
                        className="eq-icon-button"
                        onClick={() => openView(item)}
                        title="View"
                      >
                        <Eye size={15} />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            className="eq-icon-button"
                            onClick={() =>
                              openEdit(item)
                            }
                            title="Edit"
                          >
                            <Edit size={15} />
                          </button>

                          <button
                            className="eq-icon-button"
                            onClick={() =>
                              handleDelete(item)
                            }
                            title="Delete"
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          className="eq-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowForm(false);
            }
          }}
        >
          <div className="eq-modal">
            <div className="eq-modal-header">
              <h2 className="eq-modal-title">
                {editingEquipment
                  ? "Edit Equipment"
                  : "Add Equipment"}
              </h2>

              <button
                className="eq-modal-close"
                onClick={() => setShowForm(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="eq-form"
              onSubmit={handleSubmit}
            >
              <div className="eq-form-grid">
                <div className="eq-field">
                  <label>
                    Equipment Code{" "}
                    <span className="eq-required">
                      *
                    </span>
                  </label>

                  <input
                    className="eq-input"
                    value={form.equipment_code}
                    onChange={(event) =>
                      updateField(
                        "equipment_code",
                        event.target.value
                      )
                    }
                    placeholder="EQ-001"
                    required
                  />
                </div>

                <div className="eq-field">
                  <label>
                    Equipment Name{" "}
                    <span className="eq-required">
                      *
                    </span>
                  </label>

                  <input
                    className="eq-input"
                    value={form.equipment_name}
                    onChange={(event) =>
                      updateField(
                        "equipment_name",
                        event.target.value
                      )
                    }
                    placeholder="SS Reactor Agitator"
                    required
                  />
                </div>

                <div className="eq-field">
                  <label>
                    Equipment Type{" "}
                    <span className="eq-required">
                      *
                    </span>
                  </label>

                  <input
                    className="eq-input"
                    value={form.equipment_type}
                    onChange={(event) =>
                      updateField(
                        "equipment_type",
                        event.target.value
                      )
                    }
                    placeholder="Reactor / Pump / Dryer"
                    required
                  />
                </div>

                <div className="eq-field">
                  <label>Location</label>

                  <input
                    className="eq-input"
                    value={form.location}
                    onChange={(event) =>
                      updateField(
                        "location",
                        event.target.value
                      )
                    }
                    placeholder="Plant 1"
                  />
                </div>

                <div className="eq-field">
                  <label>Capacity</label>

                  <input
                    className="eq-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.capacity}
                    onChange={(event) =>
                      updateField(
                        "capacity",
                        event.target.value
                      )
                    }
                    placeholder="1000"
                  />
                </div>

                <div className="eq-field">
                  <label>Capacity Unit</label>

                  <input
                    className="eq-input"
                    value={form.capacity_unit}
                    onChange={(event) =>
                      updateField(
                        "capacity_unit",
                        event.target.value
                      )
                    }
                    placeholder="kg"
                  />
                </div>

                <div className="eq-field">
                  <label>Status</label>

                  <select
                    className="eq-input"
                    value={form.status}
                    onChange={(event) =>
                      updateField(
                        "status",
                        event.target.value
                      )
                    }
                  >
                    {EQUIPMENT_STATUSES.map(
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

                <div className="eq-field">
                  <label>Maintenance Status</label>

                  <select
                    className="eq-input"
                    value={form.maintenance_status}
                    onChange={(event) =>
                      updateField(
                        "maintenance_status",
                        event.target.value
                      )
                    }
                  >
                    {MAINTENANCE_STATUSES.map(
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

                <div className="eq-field">
                  <label>Last Maintenance</label>

                  <input
                    className="eq-input"
                    type="datetime-local"
                    value={form.last_maintenance}
                    onChange={(event) =>
                      updateField(
                        "last_maintenance",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="eq-field">
                  <label>Next Maintenance</label>

                  <input
                    className="eq-input"
                    type="datetime-local"
                    value={form.next_maintenance}
                    onChange={(event) =>
                      updateField(
                        "next_maintenance",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="eq-field">
                  <label>Utilization %</label>

                  <input
                    className="eq-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.utilization_percent}
                    onChange={(event) =>
                      updateField(
                        "utilization_percent",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="eq-field">
                  <label>Assigned Reactor</label>

                  <input
                    className="eq-input"
                    value={form.assigned_reactor}
                    onChange={(event) =>
                      updateField(
                        "assigned_reactor",
                        event.target.value
                      )
                    }
                    placeholder="R-01"
                  />
                </div>

                <div className="eq-field">
                  <label>Manufacturer</label>

                  <input
                    className="eq-input"
                    value={form.manufacturer}
                    onChange={(event) =>
                      updateField(
                        "manufacturer",
                        event.target.value
                      )
                    }
                    placeholder="Manufacturer"
                  />
                </div>

                <div className="eq-field">
                  <label>Serial Number</label>

                  <input
                    className="eq-input"
                    value={form.serial_number}
                    onChange={(event) =>
                      updateField(
                        "serial_number",
                        event.target.value
                      )
                    }
                    placeholder="SN-12345"
                  />
                </div>

                <div className="eq-field eq-form-full">
                  <label>Notes</label>

                  <textarea
                    className="eq-textarea"
                    value={form.notes}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.target.value
                      )
                    }
                    placeholder="Additional equipment notes..."
                  />
                </div>
              </div>

              {error && (
                <div
                  className="eq-alert eq-error"
                  style={{ marginTop: 15, marginBottom: 0 }}
                >
                  {error}
                </div>
              )}

              <div className="eq-modal-footer">
                <button
                  type="button"
                  className="eq-button eq-secondary"
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="eq-button eq-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={15}
                        className="eq-loading-spinner"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      {editingEquipment
                        ? "Update Equipment"
                        : "Create Equipment"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showView && viewingEquipment && (
        <div
          className="eq-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowView(false);
            }
          }}
        >
          <div className="eq-modal eq-small-modal">
            <div className="eq-modal-header">
              <div>
                <h2 className="eq-modal-title">
                  {viewingEquipment.equipment_name}
                </h2>

                <div
                  className="eq-muted"
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                  }}
                >
                  {viewingEquipment.equipment_code}
                </div>
              </div>

              <button
                className="eq-modal-close"
                onClick={() => setShowView(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="eq-details">
              <div className="eq-detail-grid">
                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Equipment Code
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.equipment_code}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Equipment Type
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.equipment_type}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Location
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.location || "—"}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Capacity
                  </div>

                  <div className="eq-detail-value">
                    {formatNumber(
                      viewingEquipment.capacity
                    )}{" "}
                    {viewingEquipment.capacity_unit}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Status
                  </div>

                  <div className="eq-detail-value">
                    <span
                      className={statusClass(
                        viewingEquipment.status
                      )}
                    >
                      {viewingEquipment.status}
                    </span>
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Maintenance
                  </div>

                  <div className="eq-detail-value">
                    <span
                      className={maintenanceClass(
                        viewingEquipment.maintenance_status
                      )}
                    >
                      {
                        viewingEquipment.maintenance_status
                      }
                    </span>
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Utilization
                  </div>

                  <div className="eq-detail-value">
                    {Number(
                      viewingEquipment.utilization_percent || 0
                    ).toFixed(1)}
                    %
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Assigned Reactor
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.assigned_reactor ||
                      "—"}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Manufacturer
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.manufacturer || "—"}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Serial Number
                  </div>

                  <div className="eq-detail-value">
                    {viewingEquipment.serial_number || "—"}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Last Maintenance
                  </div>

                  <div className="eq-detail-value">
                    {formatDate(
                      viewingEquipment.last_maintenance
                    )}
                  </div>
                </div>

                <div className="eq-detail-item">
                  <div className="eq-detail-label">
                    Next Maintenance
                  </div>

                  <div className="eq-detail-value">
                    {formatDate(
                      viewingEquipment.next_maintenance
                    )}
                  </div>
                </div>
              </div>

              {viewingEquipment.notes && (
                <div className="eq-notes">
                  <div className="eq-detail-label">
                    Notes
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  >
                    {viewingEquipment.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="eq-modal-footer">
              <button
                className="eq-button eq-secondary"
                onClick={() => setShowView(false)}
              >
                Close
              </button>

              {isAdmin && (
                <button
                  className="eq-button eq-primary"
                  onClick={() => {
                    setShowView(false);
                    openEdit(viewingEquipment);
                  }}
                >
                  <Edit size={15} />
                  Edit Equipment
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}