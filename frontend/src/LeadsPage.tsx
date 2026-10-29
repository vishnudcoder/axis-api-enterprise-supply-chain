import { useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import {
  Search, Plus, RefreshCw, ChevronRight, X,
  FileText, Building2, ClipboardCheck, CalendarClock,
  History, ArrowRightLeft, AlertCircle, CheckCircle2
} from "lucide-react";

type Row = Record<string, any>;
type Tab =
  | "Lead Details"
  | "Target Account & Research"
  | "Qualification"
  | "Activities & Follow-ups"
  | "Status & History"
  | "Conversion & Next Stage";

const TABS: { label: Tab; icon: typeof FileText }[] = [
  { label: "Lead Details", icon: FileText },
  { label: "Target Account & Research", icon: Building2 },
  { label: "Qualification", icon: ClipboardCheck },
  { label: "Activities & Follow-ups", icon: CalendarClock },
  { label: "Status & History", icon: History },
  { label: "Conversion & Next Stage", icon: ArrowRightLeft },
];

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST", "DISQUALIFIED", "ARCHIVED"];

function value(row: Row | null | undefined, ...keys: string[]) {
  if (!row) return "—";
  for (const key of keys) {
    const v = row[key];
    if (v !== null && v !== undefined && v !== "") return String(v);
  }
  return "—";
}

function dateValue(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
}

function Field({ label, value: fieldValue }: { label: string; value: unknown }) {
  return (
    <div className="lead-field">
      <div className="lead-field-label">{label}</div>
      <div className="lead-field-value">{fieldValue === null || fieldValue === undefined || fieldValue === "" ? "—" : String(fieldValue)}</div>
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Lead Details");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showQualification, setShowQualification] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  const [form, setForm] = useState({
    lead_number: "",
    lead_status: "NEW",
    source: "",
    opportunity_title: "",
    opportunity_description: "",
    opportunity_value: "",
    product_interest: "",
    expected_annual_volume: "",
    expected_closing_date: "",
    probability: "0",
    lead_priority: "MEDIUM",
    territory: "",
    competitor: "",
    next_action: "",
    expected_customer_decision_date: "",
  });

  const [qualification, setQualification] = useState({
    business_potential: "",
    customer_legitimacy: "",
    product_fit: "",
    regulatory_fit: "",
    commercial_potential: "",
    strategic_importance: "",
    qualification_decision: "",
    qualification_comments: "",
    rejection_archive_reason: "",
    status: "PENDING",
  });

  const [statusForm, setStatusForm] = useState({ new_status: "CONTACTED", reason: "" });

  async function loadLeads() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/leads", {
        params: { search: search || undefined, status: statusFilter || undefined, limit: 100, offset: 0 },
      });
      const data = response.data;
      setLeads(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load leads. Check your session and backend.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccounts() {
    try {
      const response = await api.get("/api/leads/target-accounts", { params: { limit: 100 } });
      const data = response.data;
      setAccounts(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setAccounts([]);
    }
  }

  async function openLead(row: Row) {
    const id = row.lead_id || row.id;
    if (!id) {
      setSelected(row);
      return;
    }
    setError("");
    try {
      const response = await api.get(`/api/leads/${encodeURIComponent(String(id))}`);
      const data = response.data;
      setSelected(data?.lead || data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load lead details.");
      setSelected(row);
    }
  }

  useEffect(() => {
    void loadLeads();
    void loadAccounts();
  }, []);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body: Row = {
        lead_number: form.lead_number.trim(),
        lead_status: "NEW",
        source: form.source || null,
        opportunity_title: form.opportunity_title.trim(),
        opportunity_description: form.opportunity_description || null,
        opportunity_value: form.opportunity_value === "" ? null : Number(form.opportunity_value),
        product_interest: form.product_interest || null,
        expected_annual_volume: form.expected_annual_volume === "" ? null : Number(form.expected_annual_volume),
        expected_closing_date: form.expected_closing_date || null,
        probability: form.probability === "" ? null : Number(form.probability),
        lead_priority: form.lead_priority || null,
        territory: form.territory || null,
        competitor: form.competitor || null,
        next_action: form.next_action || null,
        expected_customer_decision_date: form.expected_customer_decision_date || null,
      };
      const response = await api.post("/api/leads", body);
      setShowCreate(false);
      setForm({
        lead_number: "", lead_status: "NEW", source: "", opportunity_title: "",
        opportunity_description: "", opportunity_value: "", product_interest: "",
        expected_annual_volume: "", expected_closing_date: "", probability: "0",
        lead_priority: "MEDIUM", territory: "", competitor: "", next_action: "",
        expected_customer_decision_date: "",
      });
      setNotice("Lead created successfully.");
      await loadLeads();
      const created = response.data?.lead || response.data;
      if (created?.lead_id) await openLead(created);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Lead creation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const id = selected.lead_id || selected.id;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.post(`/api/leads/${encodeURIComponent(String(id))}/qualification`, {
        qualification_checklist: {
          business_potential: qualification.business_potential,
          customer_legitimacy: qualification.customer_legitimacy,
          product_fit: qualification.product_fit,
          regulatory_fit: qualification.regulatory_fit,
          commercial_potential: qualification.commercial_potential,
          strategic_importance: qualification.strategic_importance,
        },
        ...qualification,
        qualification_date: new Date().toISOString().slice(0, 10),
      });
      setShowQualification(false);
      setNotice("Qualification submitted.");
      await openLead(selected);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Qualification submission failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const id = selected.lead_id || selected.id;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/api/leads/${encodeURIComponent(String(id))}/status`, statusForm);
      setShowStatus(false);
      setNotice("Status transition submitted.");
      await loadLeads();
      await openLead(selected);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Status transition failed.");
    } finally {
      setSaving(false);
    }
  }

  const selectedId = selected?.lead_id || selected?.id;
  const selectedHistory = selected?.status_history || selected?.history || [];
  const selectedQualification = selected?.latest_qualification || selected?.qualification || null;
  const targetAccountId = selected?.target_account_id;
  const relatedAccount = accounts.find((a) => String(a.target_account_id || a.id) === String(targetAccountId));

  return (
    <main className="leads-workspace">
      <style>{`
        .leads-workspace{padding:24px;max-width:1600px;margin:0 auto;color:var(--text-primary,#202938)}
        .leads-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:22px}
        .leads-title{font-size:27px;font-weight:750;margin:0 0 6px}
        .leads-subtitle{color:var(--text-secondary,#687386);margin:0;font-size:14px}
        .leads-actions{display:flex;gap:9px;flex-wrap:wrap}
        .lead-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d5dbe5;border-radius:9px;padding:9px 13px;background:#fff;color:#253047;font-weight:600;cursor:pointer}
        .lead-btn.primary{background:#176b52;color:#fff;border-color:#176b52}
        .lead-btn:disabled{opacity:.55;cursor:not-allowed}
        .lead-searchbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .lead-control{border:1px solid #d6dce5;border-radius:8px;padding:10px 11px;background:#fff;color:#243044;min-width:0}
        .lead-search{display:flex;align-items:center;gap:8px;flex:1;min-width:220px;border:1px solid #d6dce5;border-radius:9px;padding:0 10px;background:#fff}
        .lead-search input{border:0;outline:0;padding:10px 0;width:100%;background:transparent}
        .lead-layout{display:grid;grid-template-columns:minmax(320px,0.9fr) minmax(450px,1.5fr);gap:18px;align-items:start}
        .lead-panel{border:1px solid #e0e5ec;border-radius:13px;background:#fff;overflow:hidden}
        .lead-panel-head{padding:15px 17px;border-bottom:1px solid #e8ebf0;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:10px}
        .lead-list{max-height:72vh;overflow:auto}
        .lead-row{padding:14px 16px;border-bottom:1px solid #edf0f4;cursor:pointer;display:flex;justify-content:space-between;gap:12px}
        .lead-row:hover,.lead-row.active{background:#f0f8f4}
        .lead-row-title{font-weight:700;margin-bottom:5px}
        .lead-muted{font-size:12px;color:#737e8e}
        .lead-pill{font-size:11px;padding:4px 7px;border-radius:99px;background:#e9f3ee;color:#176b52;font-weight:700;white-space:nowrap;height:max-content}
        .lead-tabs{display:flex;gap:4px;padding:8px;border-bottom:1px solid #e7ebf0;overflow-x:auto;background:#fafbfc}
        .lead-tab{white-space:nowrap;border:0;border-radius:7px;background:transparent;padding:9px 10px;cursor:pointer;color:#697386;font-weight:650;font-size:12px}
        .lead-tab.active{background:#176b52;color:#fff}
        .lead-content{padding:18px}
        .lead-content h3{margin:0 0 14px;font-size:16px}
        .lead-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
        .lead-field{min-width:0;border-bottom:1px solid #edf0f4;padding-bottom:11px}
        .lead-field-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#778294;margin-bottom:6px}
        .lead-field-value{font-size:14px;overflow-wrap:anywhere;font-weight:550}
        .lead-empty{padding:28px;text-align:center;color:#778294}
        .lead-alert{padding:11px 13px;border-radius:8px;margin-bottom:12px;font-size:13px;background:#fff2f0;color:#9b2c20}
        .lead-success{padding:11px 13px;border-radius:8px;margin-bottom:12px;background:#eaf7ef;color:#176b52;font-size:13px}
        .lead-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .lead-form label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:650;color:#586579}
        .lead-form input,.lead-form select,.lead-form textarea{width:100%;box-sizing:border-box;border:1px solid #d6dce5;border-radius:8px;padding:10px;font:inherit;color:#263247;background:white}
        .lead-form textarea{min-height:78px;resize:vertical}
        .lead-form .wide{grid-column:1/-1}
        .lead-form-footer{grid-column:1/-1;display:flex;gap:9px;justify-content:flex-end;padding-top:6px}
        .lead-history-item{border-left:2px solid #c8ded2;margin-left:5px;padding:0 0 18px 15px}
        .lead-modal-backdrop{position:fixed;inset:0;background:#16212c77;z-index:1000;display:grid;place-items:center;padding:20px}
        .lead-modal{width:min(760px,100%);max-height:90vh;overflow:auto;background:white;border-radius:14px;box-shadow:0 20px 70px #0003}
        .lead-modal-head{display:flex;justify-content:space-between;align-items:center;padding:18px;border-bottom:1px solid #e6eaf0}
        .lead-modal-body{padding:18px}
        @media(max-width:1000px){.lead-layout{grid-template-columns:1fr}.lead-list{max-height:360px}}
        @media(max-width:620px){.leads-workspace{padding:13px}.lead-grid,.lead-form{grid-template-columns:1fr}.lead-form .wide{grid-column:auto}.lead-tabs{padding:6px}.lead-content{padding:13px}}
      `}</style>

      <div className="leads-top">
        <div>
          <h1 className="leads-title">Commercial Leads</h1>
          <p className="leads-subtitle">Lead intake, account research, qualification and controlled progression.</p>
        </div>
        <div className="leads-actions">
          <button className="lead-btn" onClick={() => { void loadLeads(); void loadAccounts(); }}><RefreshCw size={15} /> Refresh</button>
          <button className="lead-btn primary" onClick={() => { setError(""); setShowCreate(true); }}><Plus size={16} /> New lead</button>
        </div>
      </div>

      {error && <div className="lead-alert"><AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />{error}</div>}
      {notice && <div className="lead-success"><CheckCircle2 size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />{notice}</div>}

      <div className="lead-searchbar">
        <label className="lead-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void loadLeads(); }} placeholder="Search lead number, opportunity, customer..." /></label>
        <select className="lead-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }} aria-label="Filter by lead status">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="lead-btn" onClick={() => void loadLeads()}><Search size={15} /> Search</button>
      </div>

      <div className="lead-layout">
        <section className="lead-panel">
          <div className="lead-panel-head"><span>Lead register</span><span className="lead-muted">{loading ? "Loading…" : `${leads.length} records`}</span></div>
          <div className="lead-list">
            {leads.map((lead, index) => {
              const id = lead.lead_id || lead.id;
              return (
                <button type="button" className={`lead-row ${String(selectedId) === String(id) ? "active" : ""}`} key={id || index} onClick={() => void openLead(lead)} style={{ width: "100%", textAlign: "left", border: 0, background: String(selectedId) === String(id) ? "#f0f8f4" : "white", font: "inherit" }}>
                  <span>
                    <span className="lead-row-title" style={{ display: "block" }}>{value(lead, "opportunity_title", "lead_number")}</span>
                    <span className="lead-muted">{value(lead, "lead_number")} · {value(lead, "customer_name", "customer", "target_account_name")}</span>
                  </span>
                  <span className="lead-pill">{value(lead, "lead_status", "status")}</span>
                  <ChevronRight size={15} style={{ flexShrink: 0, color: "#8a94a3" }} />
                </button>
              );
            })}
            {!loading && leads.length === 0 && <div className="lead-empty">No leads returned by the commercial workflow.</div>}
          </div>
        </section>

        <section className="lead-panel">
          {!selected ? (
            <div className="lead-empty"><FileText size={27} style={{ margin: "0 auto 12px" }} /><div>Select a lead to view its workflow.</div></div>
          ) : (
            <>
              <div className="lead-panel-head">
                <div><div style={{ fontSize: 11, color: "#778294", marginBottom: 4 }}>{value(selected, "lead_number")}</div><div>{value(selected, "opportunity_title", "lead_number")}</div></div>
                <div className="leads-actions">
                  <button className="lead-btn" onClick={() => { setStatusForm({ new_status: value(selected, "lead_status") === "NEW" ? "CONTACTED" : "QUALIFIED", reason: "" }); setShowStatus(true); }}>Transition</button>
                  <button className="lead-btn" onClick={() => setShowQualification(true)}>Qualification</button>
                </div>
              </div>
              <nav className="lead-tabs" aria-label="Lead workflow tabs">
                {TABS.map(({ label, icon: Icon }) => <button key={label} className={`lead-tab ${activeTab === label ? "active" : ""}`} onClick={() => setActiveTab(label)}><Icon size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{label}</button>)}
              </nav>
              <div className="lead-content">
                {activeTab === "Lead Details" && <>
                  <h3>Lead details</h3><div className="lead-grid">
                    <Field label="Lead number" value={value(selected, "lead_number")} />
                    <Field label="Status" value={value(selected, "lead_status", "status")} />
                    <Field label="Opportunity title" value={value(selected, "opportunity_title")} />
                    <Field label="Source" value={value(selected, "source")} />
                    <Field label="Description" value={value(selected, "opportunity_description")} />
                    <Field label="Owner" value={value(selected, "owner_name", "owner_user_id")} />
                    <Field label="Product interest" value={value(selected, "product_interest")} />
                    <Field label="Priority" value={value(selected, "lead_priority")} />
                    <Field label="Opportunity value" value={value(selected, "opportunity_value")} />
                    <Field label="Probability (%)" value={value(selected, "probability")} />
                    <Field label="Expected annual volume" value={value(selected, "expected_annual_volume")} />
                    <Field label="Expected closing date" value={dateValue(selected.expected_closing_date)} />
                    <Field label="Expected customer decision" value={dateValue(selected.expected_customer_decision_date)} />
                    <Field label="Territory" value={value(selected, "territory")} />
                    <Field label="Competitor" value={value(selected, "competitor")} />
                    <Field label="Next action" value={value(selected, "next_action")} />
                    <Field label="Created" value={dateValue(selected.created_at)} />
                    <Field label="Last updated" value={dateValue(selected.updated_at)} />
                  </div>
                </>}

                {activeTab === "Target Account & Research" && <>
                  <h3>Target account & research</h3>
                  <div className="lead-grid">
                    <Field label="Target account ID" value={value(selected, "target_account_id")} />
                    <Field label="Target account" value={value(selected, "target_account_name", "account_name") !== "—" ? value(selected, "target_account_name", "account_name") : value(relatedAccount, "target_account_name", "account_name", "name")} />
                    <Field label="Customer" value={value(selected, "customer_name", "customer_id")} />
                    <Field label="Market segment" value={value(selected, "market_segment_name", "market_segment_id")} />
                    <Field label="Territory" value={value(selected, "territory")} />
                    <Field label="Competitor" value={value(selected, "competitor")} />
                  </div>
                  <p className="lead-muted" style={{ marginTop: 18 }}>Account and research records are read from the commercial target-account workflow. The current API does not expose a lead-to-account linking action.</p>
                  <h3 style={{ marginTop: 24 }}>Available target accounts</h3>
                  {accounts.length === 0 ? <div className="lead-empty">No target accounts returned by the API.</div> : accounts.map((account, i) => <div key={account.target_account_id || account.id || i} className="lead-history-item"><strong>{value(account, "target_account_name", "account_name", "name")}</strong><div className="lead-muted">{value(account, "status")} · {value(account, "market_segment_name", "market_segment_id")}</div></div>)}
                </>}

                {activeTab === "Qualification" && <>
                  <h3>Qualification</h3>
                  {selectedQualification ? <div className="lead-grid">
                    <Field label="Decision" value={value(selectedQualification, "qualification_decision", "decision")} />
                    <Field label="Status" value={value(selectedQualification, "status")} />
                    <Field label="Business potential" value={value(selectedQualification, "business_potential")} />
                    <Field label="Customer legitimacy" value={value(selectedQualification, "customer_legitimacy")} />
                    <Field label="Product fit" value={value(selectedQualification, "product_fit")} />
                    <Field label="Regulatory fit" value={value(selectedQualification, "regulatory_fit")} />
                    <Field label="Commercial potential" value={value(selectedQualification, "commercial_potential")} />
                    <Field label="Strategic importance" value={value(selectedQualification, "strategic_importance")} />
                    <Field label="Comments" value={value(selectedQualification, "qualification_comments", "comments")} />
                    <Field label="Qualification date" value={dateValue(selectedQualification.qualification_date)} />
                  </div> : <div className="lead-empty">No qualification record returned for this lead yet.</div>}
                  <button className="lead-btn primary" onClick={() => setShowQualification(true)}><ClipboardCheck size={15} /> Submit qualification</button>
                </>}

                {activeTab === "Activities & Follow-ups" && <>
                  <h3>Activities & follow-ups</h3>
                  <div className="lead-empty"><CalendarClock size={25} style={{ margin: "0 auto 10px" }} /><div>Activity history is not exposed by the current backend routes.</div><p className="lead-muted">No activity records are fabricated. The activity API must be added before this tab can display or create commercial interactions.</p></div>
                  <Field label="Next action on lead" value={value(selected, "next_action")} />
                  <Field label="Expected customer decision" value={dateValue(selected.expected_customer_decision_date)} />
                </>}

                {activeTab === "Status & History" && <>
                  <h3>Status & history</h3>
                  <div className="lead-grid"><Field label="Current status" value={value(selected, "lead_status", "status")} /><Field label="Updated" value={dateValue(selected.updated_at)} /></div>
                  <button className="lead-btn primary" style={{ margin: "16px 0" }} onClick={() => { setStatusForm({ new_status: value(selected, "lead_status") === "NEW" ? "CONTACTED" : "QUALIFIED", reason: "" }); setShowStatus(true); }}>Transition status</button>
                  <h3 style={{ marginTop: 18 }}>Status history</h3>
                  {Array.isArray(selectedHistory) && selectedHistory.length ? selectedHistory.map((item: Row, i: number) => <div className="lead-history-item" key={item.history_id || item.id || i}><strong>{value(item, "new_status", "lead_status", "status")}</strong><div className="lead-muted">{dateValue(item.changed_at || item.created_at)} · {value(item, "reason", "changed_by")}</div></div>) : <div className="lead-empty">No status-history rows were returned by the detail endpoint.</div>}
                </>}

                {activeTab === "Conversion & Next Stage" && <>
                  <h3>Conversion & next stage</h3>
                  <div className="lead-grid"><Field label="Current status" value={value(selected, "lead_status", "status")} /><Field label="Next action" value={value(selected, "next_action")} /><Field label="Expected closing date" value={dateValue(selected.expected_closing_date)} /><Field label="Expected decision date" value={dateValue(selected.expected_customer_decision_date)} /></div>
                  <div className="lead-empty" style={{ marginTop: 16 }}>Conversion to a customer/opportunity is not exposed by the current backend API. Use the controlled status transition only when permitted by your commercial workflow.</div>
                </>}
              </div>
            </>
          )}
        </section>
      </div>

      {showCreate && <div className="lead-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
        <section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="lead-create-title">
          <div className="lead-modal-head"><strong id="lead-create-title">Create commercial lead</strong><button className="lead-btn" onClick={() => setShowCreate(false)} aria-label="Close"><X size={16} /></button></div>
          <form className="lead-modal-body lead-form" onSubmit={submitCreate}>
            <label>Lead number *<input required maxLength={100} value={form.lead_number} onChange={(e) => setForm({ ...form, lead_number: e.target.value })} /></label>
            <label>Opportunity title *<input required maxLength={250} value={form.opportunity_title} onChange={(e) => setForm({ ...form, opportunity_title: e.target.value })} /></label>
            <label>Source<input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></label>
            <label>Priority<select value={form.lead_priority} onChange={(e) => setForm({ ...form, lead_priority: e.target.value })}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label>
            <label>Opportunity value<input type="number" min="0" step="any" value={form.opportunity_value} onChange={(e) => setForm({ ...form, opportunity_value: e.target.value })} /></label>
            <label>Probability (%)<input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></label>
            <label>Product interest<input value={form.product_interest} onChange={(e) => setForm({ ...form, product_interest: e.target.value })} /></label>
            <label>Expected annual volume<input type="number" min="0" step="any" value={form.expected_annual_volume} onChange={(e) => setForm({ ...form, expected_annual_volume: e.target.value })} /></label>
            <label>Expected closing date<input type="date" value={form.expected_closing_date} onChange={(e) => setForm({ ...form, expected_closing_date: e.target.value })} /></label>
            <label>Expected customer decision<input type="date" value={form.expected_customer_decision_date} onChange={(e) => setForm({ ...form, expected_customer_decision_date: e.target.value })} /></label>
            <label>Territory<input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></label>
            <label>Competitor<input value={form.competitor} onChange={(e) => setForm({ ...form, competitor: e.target.value })} /></label>
            <label className="wide">Opportunity description<textarea value={form.opportunity_description} onChange={(e) => setForm({ ...form, opportunity_description: e.target.value })} /></label>
            <label className="wide">Next action<input value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} /></label>
            <div className="lead-form-footer"><button type="button" className="lead-btn" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="lead-btn primary" disabled={saving}>{saving ? "Creating…" : "Create lead"}</button></div>
          </form>
        </section>
      </div>}

      {showQualification && selected && <div className="lead-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowQualification(false); }}>
        <section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="qualification-title">
          <div className="lead-modal-head"><strong id="qualification-title">Lead qualification</strong><button className="lead-btn" onClick={() => setShowQualification(false)} aria-label="Close"><X size={16} /></button></div>
          <form className="lead-modal-body lead-form" onSubmit={submitQualification}>
            {(["business_potential", "customer_legitimacy", "product_fit", "regulatory_fit", "commercial_potential", "strategic_importance"] as const).map((key) => <label key={key}>{key.replace(/_/g, " ")}<select value={qualification[key]} onChange={(e) => setQualification({ ...qualification, [key]: e.target.value })}><option value="">Not assessed</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></select></label>)}
            <label>Decision<select value={qualification.qualification_decision} onChange={(e) => setQualification({ ...qualification, qualification_decision: e.target.value })}><option value="">Pending decision</option><option value="QUALIFY">Qualify</option><option value="REJECT">Reject</option><option value="ARCHIVE">Archive</option></select></label>
            <label>Status<select value={qualification.status} onChange={(e) => setQualification({ ...qualification, status: e.target.value })}><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option></select></label>
            <label className="wide">Comments<textarea value={qualification.qualification_comments} onChange={(e) => setQualification({ ...qualification, qualification_comments: e.target.value })} /></label>
            <label className="wide">Rejection/archive reason<textarea value={qualification.rejection_archive_reason} onChange={(e) => setQualification({ ...qualification, rejection_archive_reason: e.target.value })} /></label>
            <div className="lead-form-footer"><button type="button" className="lead-btn" onClick={() => setShowQualification(false)}>Cancel</button><button type="submit" className="lead-btn primary" disabled={saving}>{saving ? "Submitting…" : "Submit qualification"}</button></div>
          </form>
        </section>
      </div>}

      {showStatus && selected && <div className="lead-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowStatus(false); }}>
        <section className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="status-title">
          <div className="lead-modal-head"><strong id="status-title">Controlled status transition</strong><button className="lead-btn" onClick={() => setShowStatus(false)} aria-label="Close"><X size={16} /></button></div>
          <form className="lead-modal-body lead-form" onSubmit={submitStatus}>
            <label>New status<select required value={statusForm.new_status} onChange={(e) => setStatusForm({ ...statusForm, new_status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="wide">Reason<textarea value={statusForm.reason} onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })} /></label>
            <div className="lead-form-footer"><button type="button" className="lead-btn" onClick={() => setShowStatus(false)}>Cancel</button><button type="submit" className="lead-btn primary" disabled={saving}>{saving ? "Submitting…" : "Submit transition"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}

