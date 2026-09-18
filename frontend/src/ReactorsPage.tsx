import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { Activity, AlertTriangle, CheckCircle2, Edit3, Eye, Factory, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";

type Reactor = {
  id: number; reactor_code: string; reactor_name: string; capacity_kg: number;
  status: string; current_batch?: string | null; current_po_number?: string | null;
  current_product?: string | null; utilization_percent: number;
  available_from?: string | null; location?: string | null; notes?: string | null;
  created_at: string; updated_at: string;
};

const STATUSES = ["Idle","Cleaning","Charging","Reaction","Distillation","Maintenance","Offline"];
const blank = {reactor_code:"",reactor_name:"",capacity_kg:0,status:"Idle",current_batch:"",current_po_number:"",current_product:"",utilization_percent:0,available_from:"",location:"",notes:""};

const n = (v:any) => Number.isFinite(Number(v)) ? Number(v) : 0;
const dateText = (v?:string|null) => v ? (Number.isNaN(new Date(v).getTime()) ? v : new Date(v).toLocaleString()) : "—";

export default function ReactorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.name === "Plant Head / Admin";
  const [items,setItems] = useState<Reactor[]>([]);
  const [search,setSearch] = useState(""); const [status,setStatus] = useState("");
  const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [formOpen,setFormOpen] = useState(false); const [editing,setEditing] = useState<Reactor|null>(null);
  const [view,setView] = useState<Reactor|null>(null); const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({...blank});

  const load = async () => {
    try {
      setLoading(true); setError("");
      const r = await api.get("/api/reactors",{params:{search:search||undefined,status:status||undefined,page:1,page_size:100}});
      setItems(r.data?.items || r.data || []);
    } catch(e:any){ setError(e?.response?.data?.detail || "Unable to load reactors."); }
    finally{setLoading(false);}
  };
  useEffect(()=>{load()},[status]);

  const shown = useMemo(()=>{
    const q=search.trim().toLowerCase(); if(!q) return items;
    return items.filter(r=>[r.reactor_code,r.reactor_name,r.status,r.current_batch,r.current_po_number,r.current_product,r.location].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));
  },[items,search]);

  const stats = useMemo(()=>{
    const total=items.length, active=items.filter(r=>!["Idle","Maintenance","Offline"].includes(r.status)).length;
    const idle=items.filter(r=>r.status==="Idle").length, down=items.filter(r=>["Maintenance","Offline"].includes(r.status)).length;
    const util=total?items.reduce((a,r)=>a+n(r.utilization_percent),0)/total:0;
    return {total,active,idle,down,util};
  },[items]);

  const openCreate=()=>{setEditing(null);setForm({...blank});setFormOpen(true)};
  const openEdit=(r:Reactor)=>{
    setEditing(r); setForm({
      reactor_code:r.reactor_code,reactor_name:r.reactor_name,capacity_kg:n(r.capacity_kg),status:r.status,
      current_batch:r.current_batch||"",current_po_number:r.current_po_number||"",current_product:r.current_product||"",
      utilization_percent:n(r.utilization_percent),available_from:r.available_from?new Date(r.available_from).toISOString().slice(0,16):"",
      location:r.location||"",notes:r.notes||""
    }); setFormOpen(true);
  };

  const save=async(e:React.FormEvent)=>{
    e.preventDefault(); setSaving(true); setError("");
    try{
      const payload={...form,capacity_kg:n(form.capacity_kg),utilization_percent:n(form.utilization_percent),
        current_batch:form.current_batch||null,current_po_number:form.current_po_number||null,current_product:form.current_product||null,
        available_from:form.available_from?new Date(form.available_from).toISOString():null,location:form.location||null,notes:form.notes||null};
      if(editing) await api.put(`/api/reactors/${editing.id}`,payload); else await api.post("/api/reactors",payload);
      setFormOpen(false); await load();
    }catch(e:any){setError(e?.response?.data?.detail||"Unable to save reactor.");}
    finally{setSaving(false);}
  };

  const changeStatus=async(r:Reactor,s:string)=>{
    if(!isAdmin||s===r.status)return;
    try{await api.patch(`/api/reactors/${r.id}/status`,{status:s});await load();}
    catch(e:any){setError(e?.response?.data?.detail||"Unable to change status.");}
  };
  const remove=async(r:Reactor)=>{
    if(!isAdmin||!confirm(`Delete reactor ${r.reactor_code}?`))return;
    try{await api.delete(`/api/reactors/${r.id}`);await load();}
    catch(e:any){setError(e?.response?.data?.detail||"Unable to delete reactor.");}
  };

  const field=(label:string,key:string,type="text")=><div className="rf"><label>{label}</label>
    <input type={type} value={(form as any)[key]} onChange={e=>setForm({...form,[key]:type==="number"?Number(e.target.value):e.target.value})}/>
  </div>;

  return <div className="reactors-page"><style>{`
    .reactors-page{padding:4px 0 30px}.rh{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}
    .rt{margin:0;font-size:28px;font-weight:800;color:#172033}.rs{margin:6px 0 0;color:#667085;font-size:14px}.acts{display:flex;gap:10px}
    .btn{border:1px solid #d7dce5;background:#fff;color:#344054;border-radius:9px;padding:10px 14px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:600}.btn.primary{background:#172033;color:#fff;border-color:#172033}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:18px}.kpi{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:17px}
    .kt{display:flex;justify-content:space-between;color:#667085;font-size:11px;font-weight:700;text-transform:uppercase}.kv{margin-top:9px;font-size:25px;font-weight:800;color:#172033}.kn{font-size:12px;color:#98a2b3;margin-top:4px}
    .toolbar{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;display:flex;gap:10px;margin-bottom:14px}.search{position:relative;flex:1}.search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#98a2b3}
    .input,.select,.rf input,.rf textarea{width:100%;box-sizing:border-box;border:1px solid #d7dce5;border-radius:9px;padding:10px 12px;background:#fff;color:#172033}.search .input{padding-left:38px}
    .tablewrap{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:auto}.table{width:100%;border-collapse:collapse;min-width:1050px}.table th{background:#f8fafc;color:#667085;font-size:11px;text-transform:uppercase;text-align:left;padding:12px 14px;border-bottom:1px solid #eaecf0}.table td{padding:13px 14px;border-bottom:1px solid #f0f2f5;color:#344054;font-size:13px}
    .code{font-weight:800;color:#172033}.prod{font-weight:600;color:#172033}.tag{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:700;background:#eef2f6;color:#475467}.tag.active{background:#eaf7ef;color:#18794e}.tag.warn{background:#fff5df;color:#9a6700}.tag.danger{background:#fdecec;color:#b42318}
    .util{min-width:110px}.ul{display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px}.track{height:6px;background:#edf0f3;border-radius:20px;overflow:hidden}.fill{height:100%;background:#344054}
    .rowacts{display:flex;gap:6px}.ib{width:32px;height:32px;border:1px solid #e0e4ea;border-radius:8px;background:#fff;display:grid;place-items:center;cursor:pointer}.ib:hover{background:#f8fafc}.alert{margin-bottom:14px;padding:11px;border:1px solid #f3caca;background:#fff5f5;color:#b42318;border-radius:10px;font-size:13px}.empty{text-align:center;padding:42px;color:#667085}
    .mbg{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}.modal{background:#fff;border-radius:16px;width:min(760px,100%);max-height:90vh;overflow:auto}.mh{padding:18px 20px;border-bottom:1px solid #eaecf0;display:flex;justify-content:space-between}.mh h3{margin:0;color:#172033}.close{border:0;background:none;cursor:pointer}.form{padding:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rf{display:flex;flex-direction:column;gap:6px}.rf label{font-size:12px;font-weight:700;color:#344054}.full{grid-column:1/-1}.fa{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.details{display:grid;grid-template-columns:1fr 1fr;padding:8px 20px 20px}.di{padding:12px 0;border-bottom:1px solid #f0f2f5}.di span{display:block;font-size:11px;color:#98a2b3;text-transform:uppercase;margin-bottom:4px}.di strong{font-size:13px;color:#172033}
    @media(max-width:1100px){.kpis{grid-template-columns:repeat(3,1fr)}}@media(max-width:700px){.rh{flex-direction:column}.acts{width:100%}.btn{flex:1;justify-content:center}.kpis{grid-template-columns:1fr 1fr}.toolbar{flex-direction:column}.grid,.details{grid-template-columns:1fr}.full{grid-column:auto}.rt{font-size:23px}}
  `}</style>

    <div className="rh"><div><h1 className="rt">Reactors</h1><p className="rs">Monitor reactor capacity, production status and utilization.</p></div>
      <div className="acts"><button className="btn" onClick={load}><RefreshCw size={16}/>Refresh</button>{isAdmin&&<button className="btn primary" onClick={openCreate}><Plus size={16}/>Add Reactor</button>}</div></div>
    {error&&<div className="alert">{error}</div>}

    <div className="kpis">
      <div className="kpi"><div className="kt">Total Reactors <Factory size={17}/></div><div className="kv">{stats.total}</div><div className="kn">Configured units</div></div>
      <div className="kpi"><div className="kt">Engaged <Activity size={17}/></div><div className="kv">{stats.active}</div><div className="kn">Currently operating</div></div>
      <div className="kpi"><div className="kt">Idle <CheckCircle2 size={17}/></div><div className="kv">{stats.idle}</div><div className="kn">Available units</div></div>
      <div className="kpi"><div className="kt">Maintenance / Offline <AlertTriangle size={17}/></div><div className="kv">{stats.down}</div><div className="kn">Requires attention</div></div>
      <div className="kpi"><div className="kt">Avg Utilization <Activity size={17}/></div><div className="kv">{stats.util.toFixed(1)}%</div><div className="kn">Across all reactors</div></div>
    </div>

    <div className="toolbar"><div className="search"><Search size={17}/><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search reactor, batch, PO, product or location..."/></div>
      <select className="select" style={{maxWidth:210}} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All Statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
    </div>

    <div className="tablewrap"><table className="table"><thead><tr><th>Reactor</th><th>Capacity</th><th>Status</th><th>Batch</th><th>PO / Product</th><th>Utilization</th><th>Available From</th><th>Location</th><th>Actions</th></tr></thead>
      <tbody>{loading?<tr><td colSpan={9}><div className="empty">Loading reactors...</div></td></tr>:shown.length===0?<tr><td colSpan={9}><div className="empty">No reactors found.</div></td></tr>:
      shown.map(r=><tr key={r.id}><td><div className="code">{r.reactor_code}</div><small>{r.reactor_name}</small></td><td>{n(r.capacity_kg).toLocaleString()} kg</td>
        <td>{isAdmin?<select className="select" value={r.status} onChange={e=>changeStatus(r,e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>:<span className={`tag ${r.status==="Idle"?"":r.status==="Cleaning"?"warn":["Maintenance","Offline"].includes(r.status)?"danger":"active"}`}>{r.status}</span>}</td>
        <td>{r.current_batch||"—"}</td><td><div>{r.current_po_number||"—"}</div><div className="prod">{r.current_product||"No active product"}</div></td>
        <td><div className="util"><div className="ul"><span>Utilization</span><b>{n(r.utilization_percent).toFixed(0)}%</b></div><div className="track"><div className="fill" style={{width:`${Math.min(100,Math.max(0,n(r.utilization_percent)))}%`}}/></div></div></td>
        <td>{dateText(r.available_from)}</td><td>{r.location||"—"}</td><td><div className="rowacts"><button className="ib" title="View" onClick={()=>setView(r)}><Eye size={15}/></button>{isAdmin&&<><button className="ib" title="Edit" onClick={()=>openEdit(r)}><Edit3 size={15}/></button><button className="ib" title="Delete" onClick={()=>remove(r)}><Trash2 size={15}/></button></>}</div></td>
      </tr>)}</tbody></table></div>

    {formOpen&&<div className="mbg"><div className="modal"><div className="mh"><h3>{editing?"Edit Reactor":"Add Reactor"}</h3><button className="close" onClick={()=>setFormOpen(false)}><X/></button></div>
      <form className="form" onSubmit={save}><div className="grid">
        {field("Reactor Code *","reactor_code")}{field("Reactor Name *","reactor_name")}{field("Capacity (kg)","capacity_kg","number")}
        <div className="rf"><label>Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
        {field("Current Batch","current_batch")}{field("Current PO Number","current_po_number")}{field("Current Product","current_product")}{field("Utilization (%)","utilization_percent","number")}{field("Available From","available_from","datetime-local")}{field("Location","location")}
        <div className="rf full"><label>Notes</label><textarea rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
      </div><div className="fa"><button type="button" className="btn" onClick={()=>setFormOpen(false)}>Cancel</button><button className="btn primary" disabled={saving}>{saving?"Saving...":editing?"Save Changes":"Create Reactor"}</button></div></form>
    </div></div>}

    {view&&<div className="mbg"><div className="modal"><div className="mh"><h3>{view.reactor_code} — {view.reactor_name}</h3><button className="close" onClick={()=>setView(null)}><X/></button></div>
      <div className="details">{[["Capacity",`${n(view.capacity_kg).toLocaleString()} kg`],["Status",view.status],["Current Batch",view.current_batch||"—"],["Current PO",view.current_po_number||"—"],["Current Product",view.current_product||"—"],["Utilization",`${n(view.utilization_percent).toFixed(1)}%`],["Available From",dateText(view.available_from)],["Location",view.location||"—"],["Notes",view.notes||"—"]].map(([a,b])=><div className="di" key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
    </div></div>}
  </div>;
}
