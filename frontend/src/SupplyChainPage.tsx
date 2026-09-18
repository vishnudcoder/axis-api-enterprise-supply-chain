import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type Shipment = {
  id: number;
  shipment_number: string;
  po_number?: string | null;
  customer?: string | null;
  material_name: string;
  material_code?: string | null;
  quantity: number;
  unit: string;
  source_location?: string | null;
  destination?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  transport_mode: string;
  priority: string;
  status: string;
  expected_dispatch?: string | null;
  expected_delivery?: string | null;
  actual_dispatch?: string | null;
  actual_delivery?: string | null;
  owner?: string | null;
  notes?: string | null;
};

const STATUS_VALUES = [
  "Planned",
  "Ready for Dispatch",
  "Dispatched",
  "In Transit",
  "Delivered",
  "Delayed",
  "Cancelled",
];

const PRIORITY_VALUES = ["Low", "Normal", "High", "Urgent"];

const TRANSPORT_MODES = [
  "Road",
  "Air",
  "Sea",
  "Rail",
  "Courier",
];

const emptyForm = {
  shipment_number: "",
  po_number: "",
  customer: "",
  material_name: "",
  material_code: "",
  quantity: "",
  unit: "kg",
  source_location: "",
  destination: "",
  carrier: "",
  tracking_number: "",
  transport_mode: "Road",
  priority: "Normal",
  status: "Planned",
  expected_dispatch: "",
  expected_delivery: "",
  actual_dispatch: "",
  actual_delivery: "",
  owner: "",
  notes: "",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClass(status: string) {
  if (status === "Delivered") return "status delivered";
  if (status === "In Transit") return "status transit";
  if (status === "Delayed") return "status delayed";
  if (status === "Cancelled") return "status cancelled";
  if (status === "Ready for Dispatch") return "status ready";
  return "status planned";
}

export default function SupplyChainPage() {
  const { user } = useAuth();

  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [summary, setSummary] = useState({
    total_shipments: 0,
    total_quantity: 0,
    planned: 0,
    ready_dispatch: 0,
    in_transit: 0,
    delivered: 0,
    delayed: 0,
    urgent: 0,
  });

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingShipment, setViewingShipment] =
    useState<Shipment | null>(null);

  const [form, setForm] = useState(emptyForm);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canCreate = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const [listResponse, summaryResponse] = await Promise.all([
        api.get("/api/supply-chain", {
          params,
        }),
        api.get("/api/supply-chain/summary"),
      ]);

      setShipments(
        listResponse.data?.items ||
          listResponse.data ||
          []
      );

      setSummary(
        summaryResponse.data || {
          total_shipments: 0,
          total_quantity: 0,
          planned: 0,
          ready_dispatch: 0,
          in_transit: 0,
          delivered: 0,
          delayed: 0,
          urgent: 0,
        }
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to load Supply Chain data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, statusFilter, priorityFilter]);

  function updateField(
    field: string,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEdit(item: Shipment) {
    setEditingId(item.id);

    setForm({
      shipment_number: item.shipment_number || "",
      po_number: item.po_number || "",
      customer: item.customer || "",
      material_name: item.material_name || "",
      material_code: item.material_code || "",
      quantity: String(item.quantity ?? ""),
      unit: item.unit || "kg",
      source_location: item.source_location || "",
      destination: item.destination || "",
      carrier: item.carrier || "",
      tracking_number: item.tracking_number || "",
      transport_mode: item.transport_mode || "Road",
      priority: item.priority || "Normal",
      status: item.status || "Planned",
      expected_dispatch: item.expected_dispatch
        ? item.expected_dispatch.slice(0, 16)
        : "",
      expected_delivery: item.expected_delivery
        ? item.expected_delivery.slice(0, 16)
        : "",
      actual_dispatch: item.actual_dispatch
        ? item.actual_dispatch.slice(0, 16)
        : "",
      actual_delivery: item.actual_delivery
        ? item.actual_delivery.slice(0, 16)
        : "",
      owner: item.owner || "",
      notes: item.notes || "",
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  async function saveShipment(
    event: React.FormEvent
  ) {
    event.preventDefault();

    try {
      setError("");
      setMessage("");

      const payload = {
        shipment_number: form.shipment_number.trim(),
        po_number: form.po_number || null,
        customer: form.customer || null,
        material_name: form.material_name.trim(),
        material_code: form.material_code || null,
        quantity: Number(form.quantity || 0),
        unit: form.unit,
        source_location:
          form.source_location || null,
        destination: form.destination || null,
        carrier: form.carrier || null,
        tracking_number:
          form.tracking_number || null,
        transport_mode: form.transport_mode,
        priority: form.priority,
        status: form.status,
        expected_dispatch:
          form.expected_dispatch || null,
        expected_delivery:
          form.expected_delivery || null,
        actual_dispatch:
          form.actual_dispatch || null,
        actual_delivery:
          form.actual_delivery || null,
        owner: form.owner || null,
        notes: form.notes || null,
      };

      if (editingId) {
        await api.put(
          `/api/supply-chain/${editingId}`,
          payload
        );

        setMessage("Shipment updated successfully.");
      } else {
        await api.post(
          "/api/supply-chain",
          payload
        );

        setMessage("Shipment created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);

      await loadData();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to save shipment."
      );
    }
  }

  async function changeStatus(
    item: Shipment,
    status: string
  ) {
    try {
      setError("");

      await api.patch(
        `/api/supply-chain/${item.id}/status`,
        null,
        {
          params: { status },
        }
      );

      setMessage(
        `Shipment ${item.shipment_number} status updated.`
      );

      await loadData();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to update shipment status."
      );
    }
  }

  async function deleteShipment(
    item: Shipment
  ) {
    const confirmed = window.confirm(
      `Delete shipment ${item.shipment_number}?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.delete(
        `/api/supply-chain/${item.id}`
      );

      setMessage("Shipment deleted successfully.");

      await loadData();
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          "Unable to delete shipment."
      );
    }
  }

  const filteredCount = useMemo(
    () => shipments.length,
    [shipments]
  );

  return (
    <div className="supply-page">
      <style>{`
        .supply-page {
          padding: 24px;
          color: #172033;
        }

        .supply-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .supply-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .supply-subtitle {
          margin: 6px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .supply-actions {
          display: flex;
          gap: 10px;
        }

        .btn {
          border: 0;
          border-radius: 9px;
          padding: 10px 15px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .btn-primary {
          background: #111827;
          color: white;
        }

        .btn-secondary {
          background: white;
          color: #344054;
          border: 1px solid #d0d5dd;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .kpi {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 17px;
        }

        .kpi-label {
          font-size: 12px;
          color: #667085;
          font-weight: 700;
          text-transform: uppercase;
        }

        .kpi-value {
          font-size: 25px;
          font-weight: 800;
          margin-top: 7px;
        }

        .filters {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 14px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .search-box {
          flex: 1;
          min-width: 230px;
          position: relative;
        }

        .search-box svg {
          position: absolute;
          left: 11px;
          top: 11px;
          color: #98a2b3;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 10px 12px;
          background: white;
          outline: none;
          box-sizing: border-box;
        }

        .search-box .input {
          padding-left: 36px;
        }

        .select {
          min-width: 170px;
        }

        .table-wrap {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        th,
        td {
          padding: 13px 14px;
          border-bottom: 1px solid #eaecf0;
          text-align: left;
          font-size: 13px;
          white-space: nowrap;
        }

        th {
          color: #667085;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .04em;
          background: #f9fafb;
        }

        td strong {
          color: #101828;
        }

        .status {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .planned {
          background: #eef4ff;
          color: #175cd3;
        }

        .ready {
          background: #fff6ed;
          color: #c4320a;
        }

        .transit {
          background: #ecfdf3;
          color: #027a48;
        }

        .delivered {
          background: #ecfdf3;
          color: #027a48;
        }

        .delayed {
          background: #fef3f2;
          color: #b42318;
        }

        .cancelled {
          background: #f2f4f7;
          color: #475467;
        }

        .row-actions {
          display: flex;
          gap: 6px;
        }

        .icon-btn {
          border: 1px solid #d0d5dd;
          background: white;
          border-radius: 7px;
          padding: 7px;
          cursor: pointer;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(16, 24, 40, .48);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 100;
          padding: 20px;
        }

        .modal {
          width: min(900px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0,0,0,.2);
        }

        .modal-header {
          padding: 18px 20px;
          border-bottom: 1px solid #eaecf0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 19px;
        }

        .modal-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-label {
          font-size: 12px;
          font-weight: 700;
          color: #344054;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #eaecf0;
        }

        .alert {
          padding: 11px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .alert-success {
          background: #ecfdf3;
          color: #027a48;
        }

        .alert-error {
          background: #fef3f2;
          color: #b42318;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .detail-item {
          background: #f9fafb;
          border-radius: 9px;
          padding: 12px;
        }

        .detail-label {
          color: #667085;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .detail-value {
          margin-top: 4px;
          font-weight: 700;
          font-size: 14px;
        }

        .empty {
          padding: 45px;
          text-align: center;
          color: #667085;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 700px) {
          .supply-page {
            padding: 14px;
          }

          .supply-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .supply-actions {
            width: 100%;
          }

          .supply-actions .btn {
            flex: 1;
            justify-content: center;
          }

          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid,
          .detail-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="supply-header">
        <div>
          <h1 className="supply-title">
            Supply Chain
          </h1>

          <p className="supply-subtitle">
            Shipment planning, dispatch and delivery tracking.
          </p>
        </div>

        <div className="supply-actions">
          <button
            className="btn btn-secondary"
            onClick={loadData}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {canCreate && (
            <button
              className="btn btn-primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              Add Shipment
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="alert alert-success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">
            Total Shipments
          </div>
          <div className="kpi-value">
            {summary.total_shipments}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            Total Quantity
          </div>
          <div className="kpi-value">
            {summary.total_quantity.toLocaleString()}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            In Transit
          </div>
          <div className="kpi-value">
            {summary.in_transit}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            Delivered
          </div>
          <div className="kpi-value">
            {summary.delivered}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            Delayed
          </div>
          <div className="kpi-value">
            {summary.delayed}
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="search-box">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search shipment, PO, customer, material..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <select
          className="select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
        >
          <option value="">
            All Statuses
          </option>

          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value)
          }
        >
          <option value="">
            All Priorities
          </option>

          {PRIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty">
            Loading Supply Chain data...
          </div>
        ) : filteredCount === 0 ? (
          <div className="empty">
            <Truck
              size={35}
              style={{ marginBottom: 10 }}
            />

            <div>
              No shipments found.
            </div>

            {canCreate && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                onClick={openCreate}
              >
                <Plus size={16} />
                Add First Shipment
              </button>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shipment</th>
                <th>PO</th>
                <th>Customer</th>
                <th>Material</th>
                <th>Quantity</th>
                <th>Destination</th>
                <th>Carrier</th>
                <th>Mode</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {shipments.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.shipment_number}
                    </strong>
                  </td>

                  <td>
                    {item.po_number || "-"}
                  </td>

                  <td>
                    {item.customer || "-"}
                  </td>

                  <td>
                    {item.material_name}
                  </td>

                  <td>
                    {item.quantity.toLocaleString()}{" "}
                    {item.unit}
                  </td>

                  <td>
                    {item.destination || "-"}
                  </td>

                  <td>
                    {item.carrier || "-"}
                  </td>

                  <td>
                    {item.transport_mode}
                  </td>

                  <td>
                    {item.priority}
                  </td>

                  <td>
                    {isAdmin ? (
                      <select
                        className="select"
                        style={{
                          minWidth: 150,
                          padding: "6px 8px",
                        }}
                        value={item.status}
                        onChange={(e) =>
                          changeStatus(
                            item,
                            e.target.value
                          )
                        }
                      >
                        {STATUS_VALUES.map(
                          (value) => (
                            <option
                              key={value}
                              value={value}
                            >
                              {value}
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
                    {formatDate(
                      item.expected_delivery
                    )}
                  </td>

                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="View"
                        onClick={() => {
                          setViewingShipment(item);
                          setShowView(true);
                        }}
                      >
                        <Eye size={15} />
                      </button>

                      {canEdit && (
                        <button
                          className="icon-btn"
                          title="Edit"
                          onClick={() =>
                            openEdit(item)
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      )}

                      {canDelete && (
                        <button
                          className="icon-btn"
                          title="Delete"
                          onClick={() =>
                            deleteShipment(item)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
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
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={saveShipment}
          >
            <div className="modal-header">
              <h3>
                {editingId
                  ? "Edit Shipment"
                  : "Add Shipment"}
              </h3>

              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">
                    Shipment Number *
                  </label>

                  <input
                    className="input"
                    required
                    value={form.shipment_number}
                    onChange={(e) =>
                      updateField(
                        "shipment_number",
                        e.target.value
                      )
                    }
                    placeholder="SHP-0001"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    PO Number
                  </label>

                  <input
                    className="input"
                    value={form.po_number}
                    onChange={(e) =>
                      updateField(
                        "po_number",
                        e.target.value
                      )
                    }
                    placeholder="PO-1001"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Customer
                  </label>

                  <input
                    className="input"
                    value={form.customer}
                    onChange={(e) =>
                      updateField(
                        "customer",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Material Name *
                  </label>

                  <input
                    className="input"
                    required
                    value={form.material_name}
                    onChange={(e) =>
                      updateField(
                        "material_name",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Material Code
                  </label>

                  <input
                    className="input"
                    value={form.material_code}
                    onChange={(e) =>
                      updateField(
                        "material_code",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Quantity
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) =>
                      updateField(
                        "quantity",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Unit
                  </label>

                  <input
                    className="input"
                    value={form.unit}
                    onChange={(e) =>
                      updateField(
                        "unit",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Source Location
                  </label>

                  <input
                    className="input"
                    value={form.source_location}
                    onChange={(e) =>
                      updateField(
                        "source_location",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Destination
                  </label>

                  <input
                    className="input"
                    value={form.destination}
                    onChange={(e) =>
                      updateField(
                        "destination",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Carrier
                  </label>

                  <input
                    className="input"
                    value={form.carrier}
                    onChange={(e) =>
                      updateField(
                        "carrier",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Tracking Number
                  </label>

                  <input
                    className="input"
                    value={form.tracking_number}
                    onChange={(e) =>
                      updateField(
                        "tracking_number",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Transport Mode
                  </label>

                  <select
                    className="select"
                    value={form.transport_mode}
                    onChange={(e) =>
                      updateField(
                        "transport_mode",
                        e.target.value
                      )
                    }
                  >
                    {TRANSPORT_MODES.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Priority
                  </label>

                  <select
                    className="select"
                    value={form.priority}
                    onChange={(e) =>
                      updateField(
                        "priority",
                        e.target.value
                      )
                    }
                  >
                    {PRIORITY_VALUES.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Status
                  </label>

                  <select
                    className="select"
                    value={form.status}
                    onChange={(e) =>
                      updateField(
                        "status",
                        e.target.value
                      )
                    }
                  >
                    {STATUS_VALUES.map(
                      (value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Expected Dispatch
                  </label>

                  <input
                    className="input"
                    type="datetime-local"
                    value={
                      form.expected_dispatch
                    }
                    onChange={(e) =>
                      updateField(
                        "expected_dispatch",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Expected Delivery
                  </label>

                  <input
                    className="input"
                    type="datetime-local"
                    value={
                      form.expected_delivery
                    }
                    onChange={(e) =>
                      updateField(
                        "expected_delivery",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Owner
                  </label>

                  <input
                    className="input"
                    value={form.owner}
                    onChange={(e) =>
                      updateField(
                        "owner",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group full">
                  <label className="form-label">
                    Notes
                  </label>

                  <textarea
                    className="textarea"
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      updateField(
                        "notes",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setShowForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                {editingId
                  ? "Update Shipment"
                  : "Create Shipment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showView && viewingShipment && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3>
                Shipment{" "}
                {viewingShipment.shipment_number}
              </h3>

              <button
                className="icon-btn"
                onClick={() =>
                  setShowView(false)
                }
              >
                <X size={17} />
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="detail-label">
                    Shipment
                  </div>
                  <div className="detail-value">
                    {viewingShipment.shipment_number}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    PO Number
                  </div>
                  <div className="detail-value">
                    {viewingShipment.po_number || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Customer
                  </div>
                  <div className="detail-value">
                    {viewingShipment.customer || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Material
                  </div>
                  <div className="detail-value">
                    {viewingShipment.material_name}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Quantity
                  </div>
                  <div className="detail-value">
                    {viewingShipment.quantity.toLocaleString()}{" "}
                    {viewingShipment.unit}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Status
                  </div>
                  <div className="detail-value">
                    {viewingShipment.status}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Priority
                  </div>
                  <div className="detail-value">
                    {viewingShipment.priority}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Transport
                  </div>
                  <div className="detail-value">
                    {viewingShipment.transport_mode}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Source
                  </div>
                  <div className="detail-value">
                    {viewingShipment.source_location || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Destination
                  </div>
                  <div className="detail-value">
                    {viewingShipment.destination || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Carrier
                  </div>
                  <div className="detail-value">
                    {viewingShipment.carrier || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Tracking
                  </div>
                  <div className="detail-value">
                    {viewingShipment.tracking_number || "-"}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Expected Dispatch
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      viewingShipment.expected_dispatch
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Expected Delivery
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      viewingShipment.expected_delivery
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Actual Dispatch
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      viewingShipment.actual_dispatch
                    )}
                  </div>
                </div>

                <div className="detail-item">
                  <div className="detail-label">
                    Actual Delivery
                  </div>
                  <div className="detail-value">
                    {formatDate(
                      viewingShipment.actual_delivery
                    )}
                  </div>
                </div>

                <div
                  className="detail-item"
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <div className="detail-label">
                    Notes
                  </div>
                  <div className="detail-value">
                    {viewingShipment.notes || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setShowView(false)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}