import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Plus, Eye, Pencil, Trash2, X } from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type Plan = {
  id: number;
  plan_number: string;
  po_id?: number | null;
  po_number: string;
  customer: string;
  product: string;
  batch_number?: string | null;
  required_quantity_kg: number;
  planned_quantity_kg: number;
  reactor?: string | null;
  planned_start?: string | null;
  target_completion?: string | null;
  material_status: string;
  planning_status: string;
  production_status: string;
  owner?: string | null;
  notes?: string | null;
};

const PLAN_STATUSES = ["Draft", "Planned", "Released", "Completed", "Cancelled"];
const PRODUCTION_STATUSES = ["Not Started", "Planned", "Running", "Completed", "On Hold"];
const MATERIAL_STATUSES = ["Pending", "Partial", "Ready", "Blocked"];

const emptyForm = {
  plan_number: "",
  po_id: "",
  po_number: "",
  customer: "",
  product: "",
  batch_number: "",
  required_quantity_kg: "",
  planned_quantity_kg: "",
  reactor: "",
  planned_start: "",
  target_completion: "",
  material_status: "Pending",
  planning_status: "Draft",
  production_status: "Not Started",
  owner: "",
  notes: "",
};

export default function PPICPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [planningStatus, setPlanningStatus] = useState("All");
  const [productionStatus, setProductionStatus] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"add" | "edit" | "view" | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (planningStatus !== "All") params.set("planning_status", planningStatus);
      if (productionStatus !== "All") params.set("production_status", productionStatus);
      params.set("page", "1");
      params.set("page_size", "100");

      const [plansResponse, summaryResponse, poResponse] = await Promise.all([
        api.get(`/api/ppic?${params.toString()}`),
        api.get("/api/ppic/summary"),
        api.get("/api/purchase-orders?page=1&page_size=100"),
      ]);

      setPlans(plansResponse.data?.items || plansResponse.data || []);
      setSummary(summaryResponse.data || {});
      setPurchaseOrders(poResponse.data?.items || poResponse.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Unable to load PPIC data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, planningStatus, productionStatus]);

  function openAdd() {
    setSelected(null);
    setForm({ ...emptyForm });
    setModal("add");
  }

  function openEdit(plan: Plan) {
    setSelected(plan);
    setForm({
      ...plan,
      po_id: plan.po_id ? String(plan.po_id) : "",
      required_quantity_kg: String(plan.required_quantity_kg ?? ""),
      planned_quantity_kg: String(plan.planned_quantity_kg ?? ""),
      planned_start: plan.planned_start ? plan.planned_start.slice(0, 16) : "",
      target_completion: plan.target_completion ? plan.target_completion.slice(0, 16) : "",
    });
    setModal("edit");
  }

  function choosePO(po: any) {
    setForm((old: any) => ({
      ...old,
      po_id: String(po.id),
      po_number: po.po_number,
      customer: po.customer,
      product: po.product,
      required_quantity_kg: String(po.quantity_kg ?? ""),
      planned_quantity_kg: String(po.quantity_kg ?? ""),
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const payload = {
      plan_number: form.plan_number,
      po_id: form.po_id ? Number(form.po_id) : null,
      po_number: form.po_number,
      customer: form.customer,
      product: form.product,
      batch_number: form.batch_number || null,
      required_quantity_kg: Number(form.required_quantity_kg || 0),
      planned_quantity_kg: Number(form.planned_quantity_kg || 0),
      reactor: form.reactor || null,
      planned_start: form.planned_start ? new Date(form.planned_start).toISOString() : null,
      target_completion: form.target_completion ? new Date(form.target_completion).toISOString() : null,
      material_status: form.material_status,
      planning_status: form.planning_status,
      production_status: form.production_status,
      owner: form.owner || null,
      notes: form.notes || null,
    };

    try {
      if (modal === "edit" && selected) {
        await api.put(`/api/ppic/${selected.id}`, payload);
      } else {
        await api.post("/api/ppic", payload);
      }
      setModal(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Unable to save production plan.");
    }
  }

  async function remove(plan: Plan) {
    if (!window.confirm(`Delete production plan ${plan.plan_number}?`)) return;
    try {
      await api.delete(`/api/ppic/${plan.id}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Unable to delete production plan.");
    }
  }

  async function changeStatus(plan: Plan, value: string) {
    try {
      await api.patch(`/api/ppic/${plan.id}/status?status=${encodeURIComponent(value)}`);
      await load();
      if (selected?.id === plan.id) setSelected({ ...plan, planning_status: value });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Unable to update status.");
    }
  }

  const cards = useMemo(() => [
    ["TOTAL PLANS", summary.total_plans ?? 0, "Active production plans"],
    ["PLANNED QUANTITY", `${Number(summary.planned_quantity_kg || 0).toLocaleString()} KG`, "Total planned quantity"],
    ["DRAFT", summary.draft ?? 0, "Plans being prepared"],
    ["PLANNED", summary.planned ?? 0, "Production plans ready"],
    ["RELEASED", summary.released ?? 0, "Released to production"],
    ["RUNNING", summary.running ?? 0, "Currently in production"],
  ], [summary]);

  return (
    <div className="ppic-page">
      <style>{`
        .ppic-page{padding:36px 42px;background:#f5f8f8;min-height:calc(100vh - 60px);color:#07344a}
        .ppic-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:26px}
        .ppic-head h1{font-size:34px;margin:0 0 8px;font-weight:800}.ppic-head p{margin:0;color:#718397}
        .ppic-actions{display:flex;gap:10px}.ppic-btn{border:1px solid #d2dfe2;background:#fff;border-radius:7px;padding:10px 14px;font-weight:700;color:#07344a;cursor:pointer}.ppic-primary{background:#087f86;color:#fff;border-color:#087f86}
        .ppic-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:24px}
        .ppic-card{background:#fff;border:1px solid #d8e2e5;border-radius:11px;padding:22px 25px}.ppic-label{font-size:11px;letter-spacing:1.8px;color:#607b8b;font-weight:800}.ppic-value{font-size:32px;font-weight:800;margin:12px 0 5px}.ppic-note{font-size:13px;color:#718397}
        .ppic-toolbar{background:#fff;border:1px solid #d8e2e5;border-radius:9px;padding:14px;display:flex;gap:10px;margin-bottom:15px}
        .ppic-search{position:relative;flex:1}.ppic-search svg{position:absolute;left:11px;top:11px;color:#718397}.ppic-search input,.ppic-toolbar select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd8dc;border-radius:7px;background:#fff}.ppic-search input{padding-left:37px}.ppic-toolbar select{width:190px}
        .ppic-table-wrap{background:#fff;border:1px solid #d8e2e5;border-radius:9px;overflow:auto}.ppic-table{width:100%;border-collapse:collapse;min-width:1250px}.ppic-table th{background:#f7f9f9;padding:13px 14px;text-align:left;font-size:10px;letter-spacing:1px;color:#607b8b}.ppic-table td{padding:14px;border-top:1px solid #e6edef;font-size:13px}.ppic-plan{font-weight:800;color:#087f86}.ppic-customer{font-weight:700}.ppic-muted{color:#718397;font-size:12px}
        .ppic-badge{display:inline-block;border-radius:20px;padding:5px 9px;background:#eaf5f5;color:#08777d;font-size:10px;font-weight:800;white-space:nowrap}.ppic-badge.blocked{background:#fff0ef;color:#a5423e}
        .ppic-table select{padding:7px;border:1px solid #d0dde0;border-radius:6px;background:#fff;font-size:11px}.ppic-actions-cell{display:flex;gap:6px}.ppic-icon{border:0;background:#edf5f5;color:#08777d;padding:7px;border-radius:6px;cursor:pointer}.ppic-icon.delete{color:#a5423e;background:#fff0ef}
        .ppic-error{background:#fff0f0;color:#a33b3b;border:1px solid #efcaca;border-radius:7px;padding:11px 14px;margin-bottom:15px}.ppic-empty{text-align:center;padding:45px;color:#718397}
        .ppic-overlay{position:fixed;inset:0;background:#002b334d;display:flex;align-items:center;justify-content:center;padding:18px;z-index:100}.ppic-modal{width:min(850px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:12px;padding:28px}.ppic-modal-head{display:flex;justify-content:space-between;align-items:flex-start}.ppic-modal h2{margin:0 0 5px}.ppic-close{border:0;background:#f1f4f4;border-radius:50%;width:34px;height:34px;cursor:pointer}.ppic-form{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}.ppic-form label{font-size:12px;font-weight:700;color:#506b79}.ppic-form input,.ppic-form select,.ppic-form textarea{width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border:1px solid #ccd9dc;border-radius:7px;background:#fff;font:inherit}.ppic-form textarea{min-height:80px;resize:vertical}.ppic-full{grid-column:1/-1}.ppic-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.ppic-detail{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:22px}.ppic-detail div{background:#f7f9f9;padding:13px;border-radius:7px}.ppic-detail span{display:block;color:#718397;font-size:11px;margin-bottom:5px}.ppic-detail strong{font-size:14px}
        @media(max-width:900px){.ppic-page{padding:25px 18px}.ppic-cards{grid-template-columns:1fr 1fr}.ppic-head{flex-direction:column}.ppic-form{grid-template-columns:1fr}}
        @media(max-width:600px){.ppic-cards{grid-template-columns:1fr}.ppic-toolbar{flex-direction:column}.ppic-toolbar select{width:100%}.ppic-head h1{font-size:28px}.ppic-detail{grid-template-columns:1fr}}
      `}</style>

      <div className="ppic-head">
        <div><h1>PPIC</h1><p>Production planning, batch scheduling and material readiness.</p></div>
        <div className="ppic-actions">
          <button className="ppic-btn" onClick={load}><RefreshCw size={15} style={{verticalAlign:"middle",marginRight:6}}/>Refresh</button>
          <button className="ppic-btn ppic-primary" onClick={openAdd}><Plus size={16} style={{verticalAlign:"middle",marginRight:6}}/>Add Production Plan</button>
        </div>
      </div>

      {error && <div className="ppic-error">{error}</div>}

      <div className="ppic-cards">
        {cards.map(([label,value,note]) => <div className="ppic-card" key={String(label)}><div className="ppic-label">{label}</div><div className="ppic-value">{value}</div><div className="ppic-note">{note}</div></div>)}
      </div>

      <div className="ppic-toolbar">
        <div className="ppic-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plan, PO, customer, product, batch..."/></div>
        <select value={planningStatus} onChange={e=>setPlanningStatus(e.target.value)}><option>All</option>{PLAN_STATUSES.map(x=><option key={x}>{x}</option>)}</select>
        <select value={productionStatus} onChange={e=>setProductionStatus(e.target.value)}><option>All</option>{PRODUCTION_STATUSES.map(x=><option key={x}>{x}</option>)}</select>
      </div>

      <div className="ppic-table-wrap">
        <table className="ppic-table">
          <thead><tr><th>PLAN</th><th>PO / CUSTOMER</th><th>PRODUCT</th><th>BATCH</th><th>REQUIRED KG</th><th>PLANNED KG</th><th>REACTOR</th><th>START</th><th>MATERIAL</th><th>PLAN STATUS</th><th>PRODUCTION</th><th>ACTION</th></tr></thead>
          <tbody>
            {plans.length===0 ? <tr><td colSpan={12} className="ppic-empty">{loading?"Loading production plans...":"No production plans found."}</td></tr> :
            plans.map(plan=><tr key={plan.id}>
              <td><span className="ppic-plan">{plan.plan_number}</span></td>
              <td><span className="ppic-customer">{plan.po_number}</span><br/><span className="ppic-muted">{plan.customer}</span></td>
              <td>{plan.product}</td><td>{plan.batch_number||"—"}</td>
              <td>{Number(plan.required_quantity_kg||0).toLocaleString()}</td><td>{Number(plan.planned_quantity_kg||0).toLocaleString()}</td>
              <td>{plan.reactor||"—"}</td><td>{plan.planned_start?new Date(plan.planned_start).toLocaleDateString():"—"}</td>
              <td><span className={`ppic-badge ${plan.material_status==="Blocked"?"blocked":""}`}>{plan.material_status}</span></td>
              <td><select disabled={!isAdmin} value={plan.planning_status} onChange={e=>changeStatus(plan,e.target.value)}>{PLAN_STATUSES.map(x=><option key={x}>{x}</option>)}</select></td>
              <td><span className="ppic-badge">{plan.production_status}</span></td>
              <td><div className="ppic-actions-cell"><button className="ppic-icon" onClick={()=>{setSelected(plan);setModal("view")}}><Eye size={15}/></button>{isAdmin&&<><button className="ppic-icon" onClick={()=>openEdit(plan)}><Pencil size={15}/></button><button className="ppic-icon delete" onClick={()=>remove(plan)}><Trash2 size={15}/></button></>}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {(modal==="add"||modal==="edit") && (
        <div className="ppic-overlay" onClick={()=>setModal(null)}>
          <form className="ppic-modal" onSubmit={save} onClick={e=>e.stopPropagation()}>
            <div className="ppic-modal-head"><div><h2>{modal==="add"?"Create Production Plan":"Edit Production Plan"}</h2><div className="ppic-muted">Connect a confirmed PO to plant planning.</div></div><button type="button" className="ppic-close" onClick={()=>setModal(null)}><X size={17}/></button></div>
            <div className="ppic-form">
              <label>Plan Number<input required value={form.plan_number} onChange={e=>setForm({...form,plan_number:e.target.value})} placeholder="PP-2026-001"/></label>
              <label>Purchase Order<select value={form.po_id} onChange={e=>{const po=purchaseOrders.find(x=>String(x.id)===e.target.value);po?choosePO(po):setForm({...form,po_id:""})}}><option value="">Select PO</option>{purchaseOrders.map(po=><option key={po.id} value={po.id}>{po.po_number} — {po.customer}</option>)}</select></label>
              <label>PO Number<input required value={form.po_number} onChange={e=>setForm({...form,po_number:e.target.value})}/></label>
              <label>Customer<input required value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})}/></label>
              <label>Product<input required value={form.product} onChange={e=>setForm({...form,product:e.target.value})}/></label>
              <label>Batch Number<input value={form.batch_number} onChange={e=>setForm({...form,batch_number:e.target.value})} placeholder="BATCH-001"/></label>
              <label>Required Quantity KG<input type="number" min="0" step="0.01" value={form.required_quantity_kg} onChange={e=>setForm({...form,required_quantity_kg:e.target.value})}/></label>
              <label>Planned Quantity KG<input type="number" min="0" step="0.01" value={form.planned_quantity_kg} onChange={e=>setForm({...form,planned_quantity_kg:e.target.value})}/></label>
              <label>Reactor<input value={form.reactor} onChange={e=>setForm({...form,reactor:e.target.value})} placeholder="R-101"/></label>
              <label>Planned Start<input type="datetime-local" value={form.planned_start} onChange={e=>setForm({...form,planned_start:e.target.value})}/></label>
              <label>Target Completion<input type="datetime-local" value={form.target_completion} onChange={e=>setForm({...form,target_completion:e.target.value})}/></label>
              <label>Material Status<select value={form.material_status} onChange={e=>setForm({...form,material_status:e.target.value})}>{MATERIAL_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Planning Status<select value={form.planning_status} onChange={e=>setForm({...form,planning_status:e.target.value})}>{PLAN_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Production Status<select value={form.production_status} onChange={e=>setForm({...form,production_status:e.target.value})}>{PRODUCTION_STATUSES.map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Owner<input value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}/></label>
              <label className="ppic-full">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
            </div>
            <div className="ppic-modal-actions"><button type="button" className="ppic-btn" onClick={()=>setModal(null)}>Cancel</button><button className="ppic-btn ppic-primary">{modal==="add"?"Create Plan":"Save Changes"}</button></div>
          </form>
        </div>
      )}

      {modal==="view" && selected && (
        <div className="ppic-overlay" onClick={()=>setModal(null)}>
          <div className="ppic-modal" onClick={e=>e.stopPropagation()}>
            <div className="ppic-modal-head"><div><h2>{selected.plan_number}</h2><div className="ppic-muted">{selected.po_number} · {selected.customer}</div></div><button className="ppic-close" onClick={()=>setModal(null)}><X size={17}/></button></div>
            <div className="ppic-detail">
              <div><span>Product</span><strong>{selected.product}</strong></div><div><span>Batch</span><strong>{selected.batch_number||"—"}</strong></div>
              <div><span>Required Quantity</span><strong>{Number(selected.required_quantity_kg).toLocaleString()} KG</strong></div><div><span>Planned Quantity</span><strong>{Number(selected.planned_quantity_kg).toLocaleString()} KG</strong></div>
              <div><span>Reactor</span><strong>{selected.reactor||"—"}</strong></div><div><span>Material</span><strong>{selected.material_status}</strong></div>
              <div><span>Planning Status</span><strong>{selected.planning_status}</strong></div><div><span>Production</span><strong>{selected.production_status}</strong></div>
              <div><span>Planned Start</span><strong>{selected.planned_start?new Date(selected.planned_start).toLocaleString():"—"}</strong></div><div><span>Target Completion</span><strong>{selected.target_completion?new Date(selected.target_completion).toLocaleString():"—"}</strong></div>
              <div className="ppic-full"><span>Notes</span><strong>{selected.notes||"—"}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
