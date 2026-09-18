import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Eye, X, ArrowRight } from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type Order = {
  id: number;
  po_number: string;
  customer: string;
  product: string;
  cas_no?: string | null;
  quantity_kg: number;
  value_usd: number;
  order_date: string;
  expected_delivery?: string | null;
  status: string;
  assigned_reactor?: string | null;
  production_status: string;
  qc_status: string;
  dispatch_status: string;
  owner?: string | null;
  notes?: string | null;
  progress_percent: number;
  next_action: string;
};

const STATUSES = [
  "Confirmed",
  "Planning",
  "In Production",
  "QC Release",
  "Ready for Dispatch",
  "Dispatched",
  "Completed",
  "Cancelled",
];

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export default function OrderManagementPage() {
  const { can } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Order | null>(null);
  const [lifecycle, setLifecycle] = useState<any>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [error, setError] = useState("");

  const canEdit = can("Order Management", "edit");

  async function loadOrders() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (status !== "All") {
        params.set("status", status);
      }

      params.set("page", "1");
      params.set("page_size", "100");

      const [ordersResponse, summaryResponse] = await Promise.all([
        api.get(`/api/order-management?${params.toString()}`),
        api.get("/api/order-management/summary"),
      ]);

      setOrders(ordersResponse.data?.items || []);
      setSummary(summaryResponse.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((item: any) => item?.msg || "Request failed").join(", ")
          : detail || "Unable to load order management data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, status]);

  async function loadLifecycle(orderId: number) {
    setLifecycleLoading(true);
    setLifecycle(null);

    try {
      const response = await api.get(
        `/api/order-management/${orderId}/lifecycle`,
      );
      setLifecycle(response.data);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((item: any) => item?.msg || "Request failed").join(", ")
          : detail || "Unable to load downstream order records.",
      );
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function updateStatus(order: Order, nextStatus: string) {
    setError("");

    try {
      const response = await api.patch(
        `/api/order-management/${order.id}/status`,
        null,
        { params: { status: nextStatus } },
      );

      setSelected(response.data);
      await loadOrders();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((item: any) => item?.msg || "Request failed").join(", ")
          : detail || "Unable to update order status.",
      );
    }
  }

  const stats = useMemo(
    () => ({
      total: Number(summary?.total_orders || 0),
      value: Number(summary?.order_value_usd || 0),
      planning: Number(summary?.planning || 0),
      production: Number(summary?.in_production || 0),
      qc: Number(summary?.qc_release || 0),
      dispatch: Number(summary?.ready_for_dispatch || 0),
    }),
    [summary],
  );

  return (
    <div className="om-page">
      <style>{`
        .om-page{padding:38px 42px;background:#f5f8f8;min-height:calc(100vh - 60px);color:#07344a}
        .om-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:28px}
        .om-head h1{font-size:34px;margin:0 0 8px;font-weight:800}
        .om-head p{margin:0;color:#718397;font-size:16px}
        .om-actions{display:flex;gap:10px;align-items:center}
        .om-btn{border:1px solid #d5e0e3;background:#fff;border-radius:7px;padding:10px 14px;cursor:pointer;color:#07344a;font-weight:600}
        .om-btn:disabled{opacity:.55;cursor:not-allowed}
        .om-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:26px}
        .om-card{background:#fff;border:1px solid #d7e1e4;border-radius:12px;padding:25px 28px;box-shadow:0 1px 2px #00000008}
        .om-label{text-transform:uppercase;letter-spacing:2px;font-size:12px;color:#607b8b;font-weight:700}
        .om-value{font-size:38px;font-weight:800;margin:15px 0 5px;color:#062f45}
        .om-sub{color:#718397;font-size:14px}
        .om-toolbar{background:#fff;border:1px solid #d7e1e4;border-radius:10px;padding:15px;display:flex;gap:12px;align-items:center;margin-bottom:16px}
        .om-search{flex:1;position:relative}.om-search input{width:100%;box-sizing:border-box;padding:11px 12px 11px 38px;border:1px solid #cbd8dc;border-radius:7px;font-size:14px}
        .om-search svg{position:absolute;left:12px;top:11px;color:#718397}
        .om-select{padding:11px;border:1px solid #cbd8dc;border-radius:7px;background:#fff}
        .om-table-wrap{background:#fff;border:1px solid #d7e1e4;border-radius:10px;overflow:auto}
        .om-table{width:100%;border-collapse:collapse;min-width:1120px}
        .om-table th{background:#f7f9f9;text-align:left;padding:13px 15px;font-size:11px;letter-spacing:1px;color:#627887;text-transform:uppercase}
        .om-table td{padding:15px;border-top:1px solid #e7edef;font-size:13px;vertical-align:middle}
        .om-po{font-weight:800;color:#0a8790}.om-customer{font-weight:700}.om-muted{color:#748797}
        .om-badge{display:inline-block;padding:5px 9px;border-radius:20px;background:#e9f5f5;color:#087b80;font-size:11px;font-weight:700;white-space:nowrap}
        .om-view{border:0;background:#edf6f6;border-radius:6px;padding:7px 10px;cursor:pointer;color:#087b80}
        .om-empty{padding:45px;text-align:center;color:#718397}
        .om-error{background:#fff1f1;color:#a33b3b;border:1px solid #efcaca;padding:10px 14px;border-radius:7px;margin-bottom:14px}
        .om-progress{width:120px;height:7px;background:#e5eeee;border-radius:99px;overflow:hidden;margin-top:7px}
        .om-progress span{display:block;height:100%;background:#0a8790;border-radius:99px}
        .om-progress-label{font-size:11px;color:#718397}
        .om-modal-bg{position:fixed;inset:0;background:#002b334d;display:flex;align-items:center;justify-content:center;padding:20px;z-index:50}
        .om-modal{background:#fff;width:min(760px,100%);max-height:90vh;overflow:auto;border-radius:12px;padding:28px}
        .om-modal-head{display:flex;justify-content:space-between;align-items:center}.om-modal h2{margin:0}
        .om-close{border:0;background:#f1f4f4;border-radius:50%;width:34px;height:34px;cursor:pointer}
        .om-detail{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
        .om-detail div{background:#f7f9f9;padding:13px;border-radius:7px}.om-detail span{display:block;color:#718397;font-size:12px;margin-bottom:5px}
        .om-detail strong{font-size:14px}
        .om-lifecycle{margin-top:24px;border-top:1px solid #e7edef;padding-top:20px}
        .om-lifecycle h3{margin:0 0 14px}
        .om-steps{display:flex;gap:6px;flex-wrap:wrap}
        .om-step{padding:7px 10px;border-radius:7px;background:#eef3f4;color:#647986;font-size:12px;font-weight:700}
        .om-step.active{background:#dceff0;color:#087b80}
        .om-status{display:flex;gap:10px;margin-top:22px}.om-status select{flex:1;padding:10px;border:1px solid #ccd9dc;border-radius:7px}
        .om-status button{border:0;border-radius:7px;padding:10px 14px;background:#087b80;color:#fff;font-weight:700;cursor:pointer}
        .om-status button:disabled{opacity:.55;cursor:not-allowed}
        .om-next{margin-top:14px;padding:12px 14px;background:#f7f9f9;border-radius:7px;color:#526b78;font-size:13px}
        @media(max-width:900px){.om-page{padding:25px 18px}.om-grid{grid-template-columns:1fr 1fr}.om-head{flex-direction:column}}
        @media(max-width:600px){.om-grid{grid-template-columns:1fr}.om-toolbar{flex-direction:column;align-items:stretch}.om-detail{grid-template-columns:1fr}.om-head h1{font-size:28px}}
      `}</style>

      <div className="om-head">
        <div>
          <h1>Order Management</h1>
          <p>One operational thread from confirmed PO through customer completion.</p>
        </div>
        <div className="om-actions">
          <button className="om-btn" onClick={loadOrders} disabled={loading}>
            <RefreshCw size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="om-error">{error}</div>}

      <div className="om-grid">
        <div className="om-card"><div className="om-label">Active Orders</div><div className="om-value">{loading ? "—" : stats.total}</div><div className="om-sub">Non-cancelled customer orders</div></div>
        <div className="om-card"><div className="om-label">Order Value</div><div className="om-value">{loading ? "—" : money(stats.value)}</div><div className="om-sub">Live operational order value</div></div>
        <div className="om-card"><div className="om-label">Planning</div><div className="om-value">{loading ? "—" : stats.planning}</div><div className="om-sub">Awaiting production execution</div></div>
        <div className="om-card"><div className="om-label">In Production</div><div className="om-value">{loading ? "—" : stats.production}</div><div className="om-sub">Orders currently running</div></div>
        <div className="om-card"><div className="om-label">QC Release</div><div className="om-value">{loading ? "—" : stats.qc}</div><div className="om-sub">Quality release stage</div></div>
        <div className="om-card"><div className="om-label">Ready Dispatch</div><div className="om-value">{loading ? "—" : stats.dispatch}</div><div className="om-sub">Orders ready to ship</div></div>
      </div>

      <div className="om-toolbar">
        <div className="om-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, customer, product, reactor..."
          />
        </div>
        <select className="om-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          {STATUSES.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      <div className="om-table-wrap">
        <table className="om-table">
          <thead>
            <tr>
              <th>PO</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Qty (KG)</th>
              <th>Value</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Production</th>
              <th>QC</th>
              <th>Dispatch</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="om-empty">
                  {loading ? "Loading order management..." : "No orders found."}
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td><span className="om-po">{order.po_number}</span></td>
                  <td className="om-customer">{order.customer}</td>
                  <td>{order.product}<br /><span className="om-muted">{order.cas_no || "CAS not set"}</span></td>
                  <td>{Number(order.quantity_kg || 0).toLocaleString()}</td>
                  <td>{money(Number(order.value_usd || 0))}</td>
                  <td><span className="om-badge">{order.status}</span></td>
                  <td>
                    <div className="om-progress-label">{order.progress_percent}%</div>
                    <div className="om-progress">
                      <span style={{ width: `${order.progress_percent}%` }} />
                    </div>
                  </td>
                  <td><span className="om-badge">{order.production_status}</span></td>
                  <td><span className="om-badge">{order.qc_status}</span></td>
                  <td><span className="om-badge">{order.dispatch_status}</span></td>
                  <td>
                    <button
                      className="om-view"
                      title={`View ${order.po_number}`}
                      onClick={() => {
                        setSelected(order);
                        loadLifecycle(order.id);
                      }}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="om-modal-bg" onClick={() => {
                setSelected(null);
                setLifecycle(null);
              }}>
          <div className="om-modal" onClick={(e) => e.stopPropagation()}>
            <div className="om-modal-head">
              <div>
                <h2>{selected.po_number}</h2>
                <div className="om-muted">{selected.customer} · {selected.product}</div>
              </div>
              <button className="om-close" aria-label="Close order details" onClick={() => {
                setSelected(null);
                setLifecycle(null);
              }}>
                <X size={17} />
              </button>
            </div>

            <div className="om-detail">
              <div><span>Quantity</span><strong>{Number(selected.quantity_kg || 0).toLocaleString()} KG</strong></div>
              <div><span>Order Value</span><strong>{money(Number(selected.value_usd || 0))}</strong></div>
              <div><span>Order Date</span><strong>{new Date(selected.order_date).toLocaleDateString()}</strong></div>
              <div><span>Expected Delivery</span><strong>{selected.expected_delivery ? new Date(selected.expected_delivery).toLocaleDateString() : "—"}</strong></div>
              <div><span>Assigned Reactor</span><strong>{selected.assigned_reactor || "—"}</strong></div>
              <div><span>Owner</span><strong>{selected.owner || "—"}</strong></div>
              <div><span>Production</span><strong>{selected.production_status}</strong></div>
              <div><span>QC</span><strong>{selected.qc_status}</strong></div>
              <div><span>Dispatch</span><strong>{selected.dispatch_status}</strong></div>
              <div><span>Next Action</span><strong>{selected.next_action}</strong></div>
            </div>

            <div className="om-lifecycle">
              <h3>Order lifecycle</h3>
              <div className="om-steps">
                {STATUSES.filter((item) => item !== "Cancelled").map((item) => {
                  const currentIndex = STATUSES.indexOf(selected.status);
                  const itemIndex = STATUSES.indexOf(item);
                  return (
                    <span
                      key={item}
                      className={`om-step ${itemIndex <= currentIndex ? "active" : ""}`}
                    >
                      {item}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="om-lifecycle" data-testid="downstream-lifecycle">
              <h3>Downstream records</h3>

              {lifecycleLoading ? (
                <div className="om-empty">Loading linked records...</div>
              ) : lifecycle ? (
                <div className="om-detail">
                  <div>
                    <span>PPIC Plans</span>
                    <strong>{lifecycle.ppic_plans?.length || 0}</strong>
                  </div>
                  <div>
                    <span>Production Batches</span>
                    <strong>{lifecycle.production_batches?.length || 0}</strong>
                  </div>
                  <div>
                    <span>COAs</span>
                    <strong>{lifecycle.coas?.length || 0}</strong>
                  </div>
                  <div>
                    <span>Shipments</span>
                    <strong>{lifecycle.shipments?.length || 0}</strong>
                  </div>

                  {lifecycle.ppic_plans?.[0] && (
                    <div>
                      <span>Latest PPIC</span>
                      <strong>
                        {lifecycle.ppic_plans[0].plan_number} · {lifecycle.ppic_plans[0].planning_status}
                      </strong>
                    </div>
                  )}

                  {lifecycle.production_batches?.[0] && (
                    <div>
                      <span>Latest Batch</span>
                      <strong>
                        {lifecycle.production_batches[0].batch_number} · {lifecycle.production_batches[0].production_status}
                      </strong>
                    </div>
                  )}

                  {lifecycle.coas?.[0] && (
                    <div>
                      <span>Latest COA</span>
                      <strong>
                        {lifecycle.coas[0].coa_number} · {lifecycle.coas[0].coa_status}
                      </strong>
                    </div>
                  )}

                  {lifecycle.shipments?.[0] && (
                    <div>
                      <span>Latest Shipment</span>
                      <strong>
                        {lifecycle.shipments[0].shipment_number} · {lifecycle.shipments[0].status}
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="om-empty">
                  Downstream records are not loaded yet.
                </div>
              )}
            </div>

            <div className="om-status">
              <select
                value={selected.status}
                disabled={!canEdit}
                onChange={(e) => updateStatus(selected, e.target.value)}
              >
                {STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ArrowRight size={18} style={{ alignSelf: "center", color: "#718397" }} />
              <span style={{ alignSelf: "center", fontSize: 12, color: "#718397" }}>
                {canEdit ? "Status updates follow the operational lifecycle." : "Read-only for your role."}
              </span>
            </div>

            <div className="om-next">
              <strong>Next action:</strong> {selected.next_action}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
