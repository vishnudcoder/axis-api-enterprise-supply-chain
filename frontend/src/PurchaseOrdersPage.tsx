import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  CalendarPlus,
} from "lucide-react";
import { api } from "./api";

type PurchaseOrder = {
  id: number;
  po_number: string;
  customer: string;
  product: string;
  cas_no: string | null;
  quantity_kg: number;
  value_usd: number;
  order_date: string;
  expected_delivery: string | null;
  status: string;
  assigned_reactor: string | null;
  production_status: string;
  qc_status: string;
  dispatch_status: string;
  owner: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUSES = [
  "All",
  "Confirmed",
  "Planning",
  "In Production",
  "QC Release",
  "Ready for Dispatch",
  "Dispatched",
  "Completed",
  "Cancelled",
];

const PRODUCTION_STATUSES = [
  "Not Started",
  "Planned",
  "Running",
  "Completed",
];

const QC_STATUSES = ["Pending", "In Testing", "Released", "Rejected"];

const DISPATCH_STATUSES = ["Pending", "Ready", "Dispatched"];

const EMPTY_FORM = {
  po_number: "",
  customer: "",
  product: "",
  cas_no: "",
  quantity_kg: "",
  value_usd: "",
  order_date: "",
  expected_delivery: "",
  status: "Confirmed",
  assigned_reactor: "",
  production_status: "Not Started",
  qc_status: "Pending",
  dispatch_status: "Pending",
  owner: "",
  notes: "",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateValue(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function statusClass(value: string) {
  return `status-badge ${value.toLowerCase().replace(/ /g, "-")}`;
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [summary, setSummary] = useState<any>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("axis_user") || "null");
    } catch {
      return null;
    }
  }, []);

  const permissions = currentUser?.role?.permissions || [];
  const poPermission = permissions.find((p: any) => {
    const pageName = String(p.page || "").toLowerCase().replace(/_/g, " ");
    return pageName === "purchase orders" || pageName === "purchase-order";
  });

  const roleName = String(currentUser?.role?.name || "").toLowerCase();
  const isAdmin =
    roleName.includes("plant head") ||
    roleName.includes("admin");

  const canCreate = isAdmin || Boolean(poPermission?.can_create);
  const canEdit = isAdmin || Boolean(poPermission?.can_edit);
  const canDelete = isAdmin || Boolean(poPermission?.can_delete);

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };

      if (search.trim()) params.search = search.trim();
      if (status !== "All") params.status = status;

      const response = await api.get("/api/purchase-orders", { params });
      setOrders(response.data || []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((x: any) => x?.msg || "Unable to load POs.").join(", ")
          : typeof detail === "string"
            ? detail
            : "Unable to load purchase orders."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const response = await api.get("/api/purchase-orders/summary");
      setSummary(response.data);
    } catch {
      // The table remains usable if summary is unavailable.
    }
  }

  useEffect(() => {
    loadOrders();
    loadSummary();
  }, [page, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      loadOrders();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setFormError("");
  }

  function openAdd() {
    resetForm();
    setActionError("");
    setShowAdd(true);
  }

  function openEdit(order: PurchaseOrder) {
    setActionError("");
    setEditOrder(order);
    setForm({
      po_number: order.po_number,
      customer: order.customer,
      product: order.product,
      cas_no: order.cas_no || "",
      quantity_kg: String(order.quantity_kg ?? ""),
      value_usd: String(order.value_usd ?? ""),
      order_date: order.order_date
        ? new Date(order.order_date).toISOString().slice(0, 10)
        : "",
      expected_delivery: order.expected_delivery
        ? new Date(order.expected_delivery).toISOString().slice(0, 10)
        : "",
      status: order.status,
      assigned_reactor: order.assigned_reactor || "",
      production_status: order.production_status,
      qc_status: order.qc_status,
      dispatch_status: order.dispatch_status,
      owner: order.owner || "",
      notes: order.notes || "",
    });
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const quantity = Number(form.quantity_kg);
      const value = Number(form.value_usd);

      if (!form.po_number.trim()) throw new Error("PO number is required.");
      if (!form.customer.trim()) throw new Error("Customer is required.");
      if (!form.product.trim()) throw new Error("Product is required.");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Quantity must be greater than 0.");
      }
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Value must be 0 or greater.");
      }

      await api.post("/api/purchase-orders", {
        po_number: form.po_number.trim(),
        customer: form.customer.trim(),
        product: form.product.trim(),
        cas_no: form.cas_no.trim() || null,
        quantity_kg: quantity,
        value_usd: value,
        order_date: form.order_date
          ? new Date(`${form.order_date}T00:00:00`).toISOString()
          : null,
        expected_delivery: form.expected_delivery
          ? new Date(`${form.expected_delivery}T00:00:00`).toISOString()
          : null,
        status: form.status,
        assigned_reactor: form.assigned_reactor.trim() || null,
        production_status: form.production_status,
        qc_status: form.qc_status,
        dispatch_status: form.dispatch_status,
        owner: form.owner.trim() || null,
        notes: form.notes.trim() || null,
      });

      setShowAdd(false);
      resetForm();
      setPage(1);
      await Promise.all([loadOrders(), loadSummary()]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setFormError(
        Array.isArray(detail)
          ? detail.map((x: any) => x?.msg || "Unable to create PO.").join(", ")
          : typeof detail === "string"
            ? detail
            : err instanceof Error
              ? err.message
              : "Unable to create purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editOrder) return;

    setSaving(true);
    setActionError("");

    try {
      const quantity = Number(form.quantity_kg);
      const value = Number(form.value_usd);

      if (!form.customer.trim()) throw new Error("Customer is required.");
      if (!form.product.trim()) throw new Error("Product is required.");
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error("Quantity must be 0 or greater.");
      }
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Value must be 0 or greater.");
      }

      const response = await api.put(`/api/purchase-orders/${editOrder.id}`, {
        customer: form.customer.trim(),
        product: form.product.trim(),
        cas_no: form.cas_no.trim() || null,
        quantity_kg: quantity,
        value_usd: value,
        order_date: form.order_date
          ? new Date(`${form.order_date}T00:00:00`).toISOString()
          : null,
        expected_delivery: form.expected_delivery
          ? new Date(`${form.expected_delivery}T00:00:00`).toISOString()
          : null,
        status: form.status,
        assigned_reactor: form.assigned_reactor.trim() || null,
        production_status: form.production_status,
        qc_status: form.qc_status,
        dispatch_status: form.dispatch_status,
        owner: form.owner.trim() || null,
        notes: form.notes.trim() || null,
      });

      setEditOrder(null);
      setViewOrder(response.data);
      await Promise.all([loadOrders(), loadSummary()]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(
        Array.isArray(detail)
          ? detail.map((x: any) => x?.msg || "Unable to update PO.").join(", ")
          : typeof detail === "string"
            ? detail
            : err instanceof Error
              ? err.message
              : "Unable to update purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(order: PurchaseOrder, newStatus: string) {
    if (newStatus === order.status) return;

    setActionLoading(true);
    setActionError("");

    try {
      const response = await api.patch(
        `/api/purchase-orders/${order.id}/status`,
        null,
        { params: { status: newStatus } }
      );

      const updated = response.data as PurchaseOrder;
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setViewOrder(updated);
      await loadSummary();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(
        Array.isArray(detail)
          ? detail.map((x: any) => x?.msg || "Unable to change status.").join(", ")
          : typeof detail === "string"
            ? detail
            : "Unable to change PO status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function createProductionPlan(order: PurchaseOrder) {
    if (
      !window.confirm(
        `Create a production plan for ${order.po_number}?\n\n` +
        `Customer: ${order.customer}\n` +
        `Product: ${order.product}\n` +
        `Quantity: ${Number(order.quantity_kg).toLocaleString()} kg`
      )
    ) {
      return;
    }

    setActionLoading(true);
    setActionError("");

    try {
      const planNumber = `PP-${order.po_number}-${Date.now()
        .toString()
        .slice(-5)}`;

      await api.post("/api/ppic", {
        plan_number: planNumber,
        po_id: order.id,
        po_number: order.po_number,
        customer: order.customer,
        product: order.product,
        required_quantity_kg: Number(order.quantity_kg || 0),
        planned_quantity_kg: Number(order.quantity_kg || 0),
        reactor: order.assigned_reactor || null,
        planned_start: null,
        target_completion: order.expected_delivery || null,
        material_status: "Pending",
        planning_status: "Draft",
        production_status: order.production_status || "Not Started",
        owner: order.owner || null,
        notes: `Created from Purchase Order ${order.po_number}`,
      });

      setViewOrder(null);
      alert(
        `Production plan ${planNumber} created successfully.`
      );
    } catch (err: any) {
      console.error(err);

      const detail = err?.response?.data?.detail;
      setActionError(
        Array.isArray(detail)
          ? detail.map((x: any) => x?.msg || "Unable to create production plan.").join(", ")
          : typeof detail === "string"
            ? detail
            : "Unable to create production plan."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteOrder(order: PurchaseOrder) {
    if (!window.confirm(`Delete ${order.po_number} for ${order.customer}? This cannot be undone.`)) {
      return;
    }

    setActionLoading(true);
    setActionError("");

    try {
      await api.delete(`/api/purchase-orders/${order.id}`);
      setViewOrder(null);
      await Promise.all([loadOrders(), loadSummary()]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(
        typeof detail === "string" ? detail : "Unable to delete purchase order."
      );
    } finally {
      setActionLoading(false);
    }
  }

  const totalOrders = Number(summary?.total_orders ?? orders.length);
  const totalValue = Number(summary?.pipeline_value ?? 0);
  const inProduction = Number(summary?.in_production ?? 0);
  const qcPending = Number(summary?.qc_pending ?? 0);
  const readyDispatch = Number(summary?.ready_dispatch ?? 0);

  return (
    <div className="leads-page">
      <div className="page-header leads-page-header">
        <div>
          <h1>Purchase Orders</h1>
          <p>Confirmed customer orders and delivery status.</p>
        </div>

        {canCreate && (
          <button className="primary-button" onClick={openAdd}>
            <Plus size={17} />
            Add Purchase Order
          </button>
        )}
      </div>

      <section className="kpi-grid leads-kpis">
        <article className="kpi-card">
          <div className="eyebrow">TOTAL ORDERS</div>
          <strong>{totalOrders}</strong>
          <span>Confirmed customer orders</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">ORDER VALUE</div>
          <strong>{money(totalValue)}</strong>
          <span>Non-cancelled order value</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">IN PRODUCTION</div>
          <strong>{inProduction}</strong>
          <span>Orders currently running</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">QC PENDING</div>
          <strong>{qcPending}</strong>
          <span>Testing or release pending</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">READY DISPATCH</div>
          <strong>{readyDispatch}</strong>
          <span>Orders ready to ship</span>
        </article>
      </section>

      <section className="leads-panel">
        <div className="leads-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search PO, customer, product or owner..."
            />
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">STATUS</div>
          <div className="filter-buttons">
            {STATUSES.map((item) => (
              <button
                key={item}
                className={status === item ? "filter-button active" : "filter-button"}
                onClick={() => {
                  setStatus(item);
                  setPage(1);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <div className="form-error leads-error">{error}</div>}

      <section className="dashboard-panel leads-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Live purchase orders</h2>
            <p>Orders currently moving through planning, production, QC and dispatch.</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => Promise.all([loadOrders(), loadSummary()])}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="table-loading">Loading purchase orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No purchase orders found</h3>
            <p>Create a PO or change the search/status filter.</p>
          </div>
        ) : (
          <div className="responsive-table leads-table">
            <table>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT / CAS</th>
                  <th>QTY</th>
                  <th>VALUE</th>
                  <th>DELIVERY</th>
                  <th>STATUS</th>
                  <th>REACTOR</th>
                  <th>PRODUCTION</th>
                  <th>QC</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.po_number}</strong></td>
                    <td><strong>{order.customer}</strong></td>
                    <td>
                      <div className="lead-product">
                        <strong>{order.product}</strong>
                        <span>{order.cas_no || "—"}</span>
                      </div>
                    </td>
                    <td>{Number(order.quantity_kg).toLocaleString()} kg</td>
                    <td><strong>{money(order.value_usd)}</strong></td>
                    <td>{dateValue(order.expected_delivery)}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td>{order.assigned_reactor || "—"}</td>
                    <td>{order.production_status}</td>
                    <td>{order.qc_status}</td>
                    <td>
                      <div className="lead-actions">
                        <button
                          className="icon-button"
                          title="View PO"
                          onClick={() => {
                            setActionError("");
                            setViewOrder(order);
                          }}
                        >
                          <Eye size={16} />
                        </button>

                        {canEdit && (
                          <button
                            className="icon-button"
                            title="Edit PO"
                            onClick={() => openEdit(order)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="icon-button danger"
                            title="Delete PO"
                            onClick={() => deleteOrder(order)}
                            disabled={actionLoading}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>Page {page}</span>
          <div>
            <button
              className="icon-button"
              disabled={page === 1}
              onClick={() => setPage((v) => Math.max(1, v - 1))}
            >
              <ChevronLeft size={17} />
            </button>

            <button
              className="icon-button"
              disabled={orders.length < pageSize}
              onClick={() => setPage((v) => v + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {(showAdd || editOrder) && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setShowAdd(false);
              setEditOrder(null);
              setFormError("");
              setActionError("");
            }
          }}
          style={modalBackdrop(1000)}
        >
          <form
            onSubmit={editOrder ? saveEdit : createOrder}
            style={modalCard()}
          >
            <div style={modalHeader()}>
              <div>
                <div className="eyebrow">{editOrder ? "EDIT PURCHASE ORDER" : "NEW PURCHASE ORDER"}</div>
                <h2 style={{ margin: "4px 0 0" }}>
                  {editOrder ? editOrder.po_number : "Add Purchase Order"}
                </h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  {editOrder
                    ? "Update the operational order record."
                    : "Create a confirmed customer order."}
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  if (!saving) {
                    setShowAdd(false);
                    setEditOrder(null);
                  }
                }}
              >
                <X size={18} />
              </button>
            </div>

            {(formError || actionError) && (
              <div className="form-error" style={{ marginBottom: 16, padding: "10px 12px" }}>
                {formError || actionError}
              </div>
            )}

            <div style={formGrid()}>
              {!editOrder && (
                <label>
                  <span>PO Number *</span>
                  <input
                    required
                    value={form.po_number}
                    onChange={(e) => setField("po_number", e.target.value)}
                    placeholder="PO-2026-001"
                  />
                </label>
              )}

              <label>
                <span>Customer *</span>
                <input
                  required
                  value={form.customer}
                  onChange={(e) => setField("customer", e.target.value)}
                />
              </label>

              <label>
                <span>Product *</span>
                <input
                  required
                  value={form.product}
                  onChange={(e) => setField("product", e.target.value)}
                />
              </label>

              <label>
                <span>CAS No.</span>
                <input
                  value={form.cas_no}
                  onChange={(e) => setField("cas_no", e.target.value)}
                />
              </label>

              <label>
                <span>Quantity (kg) *</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity_kg}
                  onChange={(e) => setField("quantity_kg", e.target.value)}
                />
              </label>

              <label>
                <span>Value (USD) *</span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value_usd}
                  onChange={(e) => setField("value_usd", e.target.value)}
                />
              </label>

              <label>
                <span>Order Date</span>
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(e) => setField("order_date", e.target.value)}
                />
              </label>

              <label>
                <span>Expected Delivery</span>
                <input
                  type="date"
                  value={form.expected_delivery}
                  onChange={(e) => setField("expected_delivery", e.target.value)}
                />
              </label>

              <label>
                <span>PO Status</span>
                <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                  {STATUSES.filter((x) => x !== "All").map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Assigned Reactor</span>
                <input
                  value={form.assigned_reactor}
                  onChange={(e) => setField("assigned_reactor", e.target.value)}
                  placeholder="R-101"
                />
              </label>

              <label>
                <span>Production Status</span>
                <select
                  value={form.production_status}
                  onChange={(e) => setField("production_status", e.target.value)}
                >
                  {PRODUCTION_STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>

              <label>
                <span>QC Status</span>
                <select value={form.qc_status} onChange={(e) => setField("qc_status", e.target.value)}>
                  {QC_STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>

              <label>
                <span>Dispatch Status</span>
                <select
                  value={form.dispatch_status}
                  onChange={(e) => setField("dispatch_status", e.target.value)}
                >
                  {DISPATCH_STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>

              <label>
                <span>Owner</span>
                <input
                  value={form.owner}
                  onChange={(e) => setField("owner", e.target.value)}
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </label>
            </div>

            <div style={modalFooter()}>
              <button
                type="button"
                className="secondary-button"
                disabled={saving}
                onClick={() => {
                  setShowAdd(false);
                  setEditOrder(null);
                }}
              >
                Cancel
              </button>

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : editOrder ? "Save Changes" : "Create PO"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewOrder && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !actionLoading) {
              setViewOrder(null);
              setActionError("");
            }
          }}
          style={modalBackdrop(1001)}
        >
          <div style={modalCard()}>
            <div style={modalHeader()}>
              <div>
                <div className="eyebrow">PURCHASE ORDER DETAILS</div>
                <h2 style={{ margin: "4px 0 0" }}>{viewOrder.po_number}</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  {viewOrder.customer} · {viewOrder.product}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => setViewOrder(null)}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div className="form-error" style={{ marginBottom: 16 }}>
                {actionError}
              </div>
            )}

            <div style={detailsGrid()}>
              {[
                ["Customer", viewOrder.customer],
                ["Product", viewOrder.product],
                ["CAS No.", viewOrder.cas_no || "—"],
                ["Quantity", `${Number(viewOrder.quantity_kg).toLocaleString()} kg`],
                ["Value", money(viewOrder.value_usd)],
                ["Order Date", dateValue(viewOrder.order_date)],
                ["Expected Delivery", dateValue(viewOrder.expected_delivery)],
                ["Assigned Reactor", viewOrder.assigned_reactor || "—"],
                ["Production", viewOrder.production_status],
                ["QC", viewOrder.qc_status],
                ["Dispatch", viewOrder.dispatch_status],
                ["Owner", viewOrder.owner || "—"],
              ].map(([label, value]) => (
                <div key={label} style={detailBox()}>
                  <div className="eyebrow">{label}</div>
                  <div style={{ marginTop: 7, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>STATUS</div>
              <select
                value={viewOrder.status}
                disabled={actionLoading || !canEdit}
                onChange={(e) => changeStatus(viewOrder, e.target.value)}
                style={{
                  minWidth: 240,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                }}
              >
                {STATUSES.filter((x) => x !== "All").map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>

            {viewOrder.notes && (
              <div style={{ marginTop: 18 }}>
                <div className="eyebrow">NOTES</div>
                <p style={{ color: "#475569" }}>{viewOrder.notes}</p>
              </div>
            )}

            <div style={modalFooter()}>
              {canEdit && (
                <button
                  className="secondary-button"
                  disabled={actionLoading}
                  onClick={() => createProductionPlan(viewOrder)}
                >
                  <CalendarPlus size={16} />
                  Create Production Plan
                </button>
              )}

              {canEdit && (
                <button
                  className="secondary-button"
                  disabled={actionLoading}
                  onClick={() => {
                    const order = viewOrder;
                    setViewOrder(null);
                    openEdit(order);
                  }}
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  className="secondary-button"
                  disabled={actionLoading}
                  onClick={() => deleteOrder(viewOrder)}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function modalBackdrop(zIndex: number): CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex,
    overflowY: "auto",
  };
}

function modalCard(): CSSProperties {
  return {
    width: "min(960px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 14,
    padding: 24,
    boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
  };
}

function modalHeader(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 20,
  };
}

function modalFooter(): CSSProperties {
  return {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 24,
    paddingTop: 18,
    borderTop: "1px solid #e2e8f0",
  };
}

function formGrid(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 16,
  };
}

function detailsGrid(): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  };
}

function detailBox(): CSSProperties {
  return {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 14,
  };
}


