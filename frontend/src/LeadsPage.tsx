import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api } from "./api";

type Lead = {
  id: number;
  enquiry_id: string;
  customer: string;
  product: string;
  cas_no: string | null;
  market: string;
  regulatory_path: string | null;
  tech_pack: string;
  quantity_kg: number;
  value_usd: number;
  stage: string;
  owner: string | null;
  next_step: string | null;
  development: boolean;
  created_at: string;
  updated_at: string;
};

const STAGES = [
  "All",
  "Lead",
  "COA Shared",
  "Sample Sent",
  "Quote Sent",
  "PO Received",
];

const MARKETS = ["All", "US", "EU", "Japan", "ROW"];

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("All");
  const [market, setMarket] = useState("All");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [showAddLead, setShowAddLead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({
    customer: "",
    product: "",
    cas_no: "",
    market: "US",
    regulatory_path: "",
    tech_pack: "Pending",
    quantity_kg: "",
    value_usd: "",
    stage: "Lead",
    owner: "",
    next_step: "",
    development: false,
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("axis_user") || "null");
    } catch {
      return null;
    }
  }, []);

  const leadPermissions = currentUser?.role?.permissions?.find(
  (permission: any) =>
    String(permission.page || "").toLowerCase() === "leads",
);

const isAdmin =
  currentUser?.role?.name === "Plant Head / Admin";

const canCreate =
  isAdmin || Boolean(leadPermissions?.can_create);

const canEdit =
  isAdmin || Boolean(leadPermissions?.can_edit);

const canDelete =
  isAdmin || Boolean(leadPermissions?.can_delete);

  const [form, setForm] = useState({
    enquiry_id: "",
    customer: "",
    product: "",
    cas_no: "",
    market: "US",
    regulatory_path: "",
    tech_pack: "Pending",
    quantity_kg: "",
    value_usd: "",
    stage: "Lead",
    owner: "",
    next_step: "",
    development: false,
  });

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (stage !== "All") {
        params.stage = stage;
      }

      if (market !== "All") {
        params.market = market;
      }

      const response = await api.get("/api/leads", { params });
      setLeads(response.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail.map((item) => item?.msg || "Unable to load leads.").join(", "),
        );
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Unable to load leads. Check that the backend is running.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [page, stage, market]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      loadLeads();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const summary = useMemo(() => {
    const pipeline = leads.reduce(
      (total, lead) => total + Number(lead.value_usd || 0),
      0,
    );

    const regulated = leads.filter(
      (lead) => lead.market !== "ROW",
    ).length;

    const pendingTechPack = leads.filter(
      (lead) => lead.tech_pack.toLowerCase() === "pending",
    ).length;

    const development = leads.filter(
      (lead) => lead.development,
    ).length;

    return {
      count: leads.length,
      pipeline,
      regulated,
      pendingTechPack,
      development,
    };
  }, [leads]);

  function stageClass(value: string) {
    return `status-badge ${value
      .toLowerCase()
      .replace(/ /g, "-")}`;
  }

  function updateForm(
    field: keyof typeof form,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      enquiry_id: "",
      customer: "",
      product: "",
      cas_no: "",
      market: "US",
      regulatory_path: "",
      tech_pack: "Pending",
      quantity_kg: "",
      value_usd: "",
      stage: "Lead",
      owner: "",
      next_step: "",
      development: false,
    });
    setFormError("");
  }

  function openAddLead() {
    resetForm();
    setShowAddLead(true);
  }

  function openViewLead(lead: Lead) {
    setActionError("");
    setSelectedLead(lead);
  }

  function openEditLead(lead: Lead) {
    setActionError("");
    setEditingLead(lead);
    setEditForm({
      customer: lead.customer,
      product: lead.product,
      cas_no: lead.cas_no || "",
      market: lead.market,
      regulatory_path: lead.regulatory_path || "",
      tech_pack: lead.tech_pack,
      quantity_kg: String(lead.quantity_kg ?? ""),
      value_usd: String(lead.value_usd ?? ""),
      stage: lead.stage,
      owner: lead.owner || "",
      next_step: lead.next_step || "",
      development: lead.development,
    });
  }

  function closeDetails() {
    if (!actionLoading) {
      setSelectedLead(null);
      setActionError("");
    }
  }

  function closeEditLead() {
    if (!actionLoading) {
      setEditingLead(null);
      setActionError("");
    }
  }

  function updateEditForm(
    field: keyof typeof editForm,
    value: string | boolean,
  ) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveEditedLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingLead) return;

    setActionError("");
    setActionLoading(true);

    try {
      const quantity = Number(editForm.quantity_kg);
      const value = Number(editForm.value_usd);

      if (!editForm.customer.trim()) {
        throw new Error("Customer is required.");
      }

      if (!editForm.product.trim()) {
        throw new Error("Product is required.");
      }

      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new Error("Quantity must be 0 or greater.");
      }

      if (!Number.isFinite(value) || value < 0) {
        throw new Error("Value must be 0 or greater.");
      }

      const response = await api.put(`/api/leads/${editingLead.id}`, {
        customer: editForm.customer.trim(),
        product: editForm.product.trim(),
        cas_no: editForm.cas_no.trim() || null,
        market: editForm.market,
        regulatory_path: editForm.regulatory_path.trim() || null,
        tech_pack: editForm.tech_pack,
        quantity_kg: quantity,
        value_usd: value,
        stage: editForm.stage,
        owner: editForm.owner.trim() || null,
        next_step: editForm.next_step.trim() || null,
        development: editForm.development,
      });

      const updated = response.data as Lead;

      setEditingLead(null);
      setSelectedLead(updated);
      await loadLeads();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setActionError(
          detail.map((item) => item?.msg || "Unable to update lead.").join(", "),
        );
      } else if (typeof detail === "string") {
        setActionError(detail);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Unable to update lead.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function changeStage(lead: Lead, newStage: string) {
    if (lead.stage === newStage) return;

    setActionError("");
    setActionLoading(true);

    try {
      const response = await api.patch(
        `/api/leads/${lead.id}/stage`,
        null,
        { params: { stage: newStage } },
      );

      const updated = response.data.lead as Lead;

      setLeads((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );

      setSelectedLead(updated);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(
        Array.isArray(detail)
          ? detail.map((item) => item?.msg || "Unable to change stage.").join(", ")
          : typeof detail === "string"
            ? detail
            : "Unable to change lead stage.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteLead(lead: Lead) {
    const confirmed = window.confirm(
      `Delete ${lead.enquiry_id} for ${lead.customer}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setActionError("");
    setActionLoading(true);

    try {
      await api.delete(`/api/leads/${lead.id}`);
      setSelectedLead(null);
      await loadLeads();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(
        Array.isArray(detail)
          ? detail.map((item) => item?.msg || "Unable to delete lead.").join(", ")
          : typeof detail === "string"
            ? detail
            : "Unable to delete lead.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  function closeAddLead() {
    if (!saving) {
      setShowAddLead(false);
      setFormError("");
    }
  }

  async function createLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const payload = {
        enquiry_id: form.enquiry_id.trim(),
        customer: form.customer.trim(),
        product: form.product.trim(),
        cas_no: form.cas_no.trim() || null,
        market: form.market,
        regulatory_path: form.regulatory_path.trim() || null,
        tech_pack: form.tech_pack,
        quantity_kg: Number(form.quantity_kg),
        value_usd: Number(form.value_usd),
        stage: form.stage,
        owner: form.owner.trim() || null,
        next_step: form.next_step.trim() || null,
        development: form.development,
      };

      if (!payload.enquiry_id) {
        throw new Error("Enquiry ID is required.");
      }

      if (!payload.customer) {
        throw new Error("Customer is required.");
      }

      if (!payload.product) {
        throw new Error("Product is required.");
      }

      if (!Number.isFinite(payload.quantity_kg) || payload.quantity_kg <= 0) {
        throw new Error("Quantity must be greater than 0.");
      }

      if (!Number.isFinite(payload.value_usd) || payload.value_usd < 0) {
        throw new Error("Value must be 0 or greater.");
      }

      await api.post("/api/leads", payload);

      setShowAddLead(false);
      resetForm();
      setPage(1);
      await loadLeads();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setFormError(
          detail.map((item) => item?.msg || "Unable to create lead.").join(", "),
        );
      } else if (typeof detail === "string") {
        setFormError(detail);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Unable to create lead. Check that the backend is running.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="leads-page">
      <div className="page-header leads-page-header">
        <div>
          <h1>Leads &amp; Enquiries</h1>
          <p>Customer enquiries and commercial pipeline.</p>
        </div>

        {canCreate && (
          <button className="primary-button" onClick={openAddLead}>
            <Plus size={17} />
            Add Lead
          </button>
        )}
      </div>

      <section className="kpi-grid leads-kpis">
        <article className="kpi-card">
          <div className="eyebrow">LIVE ENQUIRIES</div>
          <strong>{summary.count}</strong>
          <span>Active commercial enquiries</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">PIPELINE VALUE</div>
          <strong>{money(summary.pipeline)}</strong>
          <span>Current enquiry value</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">REGULATED MARKETS</div>
          <strong>{summary.regulated}</strong>
          <span>US, EU and Japan</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">TECH-PACK PENDING</div>
          <strong>{summary.pendingTechPack}</strong>
          <span>Requiring action</span>
        </article>

        <article className="kpi-card">
          <div className="eyebrow">DEVELOPMENT</div>
          <strong>{summary.development}</strong>
          <span>Development enquiries</span>
        </article>
      </section>

      <section className="leads-panel">
        <div className="leads-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search enquiry, customer, product or owner..."
            />
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">STAGE</div>

          <div className="filter-buttons">
            {STAGES.map((item) => (
              <button
                key={item}
                className={stage === item ? "filter-button active" : "filter-button"}
                onClick={() => {
                  setStage(item);
                  setPage(1);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <div className="filter-label">MARKET</div>

          <div className="filter-buttons">
            {MARKETS.map((item) => (
              <button
                key={item}
                className={market === item ? "filter-button active" : "filter-button"}
                onClick={() => {
                  setMarket(item);
                  setPage(1);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="form-error leads-error">
          {error}
        </div>
      )}

      <section className="dashboard-panel leads-table-panel">
        <div className="panel-title-row">
          <div>
            <h2>Live enquiries</h2>
            <p>
              Leads and customer enquiries currently moving through the
              commercial funnel.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={loadLeads}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="table-loading">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            <h3>No enquiries found</h3>
            <p>
              Try changing the filters or search term.
            </p>
          </div>
        ) : (
          <div className="responsive-table leads-table">
            <table>
              <thead>
                <tr>
                  <th>ENQUIRY</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT / CAS</th>
                  <th>MARKET</th>
                  <th>REGULATORY PATH</th>
                  <th>TECH PACK</th>
                  <th>QTY</th>
                  <th>VALUE</th>
                  <th>STAGE</th>
                  <th>OWNER</th>
                  <th>NEXT STEP</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <strong>{lead.enquiry_id}</strong>
                    </td>

                    <td>
                      <strong>{lead.customer}</strong>
                    </td>

                    <td>
                      <div className="lead-product">
                        <strong>{lead.product}</strong>
                        <span>{lead.cas_no || "—"}</span>
                      </div>
                    </td>

                    <td>
                      <span className="market-badge">
                        {lead.market}
                      </span>
                    </td>

                    <td>
                      {lead.regulatory_path || "—"}
                    </td>

                    <td>
                      <span
                        className={
                          lead.tech_pack.toLowerCase() === "pending"
                            ? "tech-pack pending"
                            : "tech-pack complete"
                        }
                      >
                        {lead.tech_pack}
                      </span>
                    </td>

                    <td>
                      {Number(lead.quantity_kg).toLocaleString()} kg
                    </td>

                    <td>
                      <strong>{money(Number(lead.value_usd))}</strong>
                    </td>

                    <td>
                      <span className={stageClass(lead.stage)}>
                        {lead.stage}
                      </span>
                    </td>

                    <td>
                      {lead.owner || "—"}
                    </td>

                    <td>
                      {lead.next_step || "—"}
                    </td>

                    <td>
                      <div className="lead-actions">
                        <button
                          className="icon-button"
                          title="View lead"
                          onClick={() => openViewLead(lead)}
                        >
                          <Eye size={16} />
                        </button>

                        {canEdit && (
                          <button
                            className="icon-button"
                            title="Edit lead"
                            onClick={() => openEditLead(lead)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="icon-button danger"
                            title="Delete lead"
                            onClick={() => deleteLead(lead)}
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
          <span>
            Page {page}
          </span>

          <div>
            <button
              className="icon-button"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={17} />
            </button>

            <button
              className="icon-button"
              disabled={leads.length < pageSize}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {selectedLead && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDetails();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              width: "min(900px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <div className="eyebrow">LEAD DETAILS</div>
                <h2 style={{ margin: "4px 0 0" }}>
                  {selectedLead.enquiry_id}
                </h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  {selectedLead.customer} · {selectedLead.product}
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeDetails}
                disabled={actionLoading}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                className="form-error"
                style={{ marginBottom: "16px", padding: "10px 12px" }}
              >
                {actionError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "14px",
              }}
            >
              {[
                ["Customer", selectedLead.customer],
                ["Product", selectedLead.product],
                ["CAS No.", selectedLead.cas_no || "—"],
                ["Market", selectedLead.market],
                ["Regulatory Path", selectedLead.regulatory_path || "—"],
                ["Tech Pack", selectedLead.tech_pack],
                ["Quantity", `${Number(selectedLead.quantity_kg).toLocaleString()} kg`],
                ["Value", money(Number(selectedLead.value_usd))],
                ["Owner", selectedLead.owner || "—"],
                ["Next Step", selectedLead.next_step || "—"],
                ["Development", selectedLead.development ? "Yes" : "No"],
                ["Created", new Date(selectedLead.created_at).toLocaleString()],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div className="eyebrow">{label}</div>
                  <div style={{ marginTop: "7px", fontWeight: 600 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px" }}>
              <div className="eyebrow" style={{ marginBottom: "8px" }}>
                STAGE
              </div>

              <select
                value={selectedLead.stage}
                disabled={actionLoading}
                onChange={(event) =>
                  changeStage(selectedLead, event.target.value)
                }
                style={{
                  minWidth: "220px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              >
                {STAGES.filter((item) => item !== "All").map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              {canEdit && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const lead = selectedLead;
                    setSelectedLead(null);
                    openEditLead(lead);
                  }}
                  disabled={actionLoading}
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => deleteLead(selectedLead)}
                  disabled={actionLoading}
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingLead && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditLead();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1001,
            overflowY: "auto",
          }}
        >
          <form
            onSubmit={saveEditedLead}
            style={{
              width: "min(900px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div>
                <div className="eyebrow">EDIT LEAD</div>
                <h2 style={{ margin: "4px 0 0" }}>
                  {editingLead.enquiry_id}
                </h2>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeEditLead}
                disabled={actionLoading}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                className="form-error"
                style={{ marginBottom: "16px", padding: "10px 12px" }}
              >
                {actionError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              <label>
                <span>Customer *</span>
                <input
                  required
                  value={editForm.customer}
                  onChange={(event) =>
                    updateEditForm("customer", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Product *</span>
                <input
                  required
                  value={editForm.product}
                  onChange={(event) =>
                    updateEditForm("product", event.target.value)
                  }
                />
              </label>

              <label>
                <span>CAS No.</span>
                <input
                  value={editForm.cas_no}
                  onChange={(event) =>
                    updateEditForm("cas_no", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Market</span>
                <select
                  value={editForm.market}
                  onChange={(event) =>
                    updateEditForm("market", event.target.value)
                  }
                >
                  {MARKETS.filter((item) => item !== "All").map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Regulatory Path</span>
                <input
                  value={editForm.regulatory_path}
                  onChange={(event) =>
                    updateEditForm("regulatory_path", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Tech Pack</span>
                <select
                  value={editForm.tech_pack}
                  onChange={(event) =>
                    updateEditForm("tech_pack", event.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                </select>
              </label>

              <label>
                <span>Quantity (kg)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.quantity_kg}
                  onChange={(event) =>
                    updateEditForm("quantity_kg", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Value (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.value_usd}
                  onChange={(event) =>
                    updateEditForm("value_usd", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Stage</span>
                <select
                  value={editForm.stage}
                  onChange={(event) =>
                    updateEditForm("stage", event.target.value)
                  }
                >
                  {STAGES.filter((item) => item !== "All").map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Owner</span>
                <input
                  value={editForm.owner}
                  onChange={(event) =>
                    updateEditForm("owner", event.target.value)
                  }
                />
              </label>

              <label>
                <span>Next Step</span>
                <input
                  value={editForm.next_step}
                  onChange={(event) =>
                    updateEditForm("next_step", event.target.value)
                  }
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  paddingTop: "25px",
                }}
              >
                <input
                  type="checkbox"
                  checked={editForm.development}
                  onChange={(event) =>
                    updateEditForm("development", event.target.checked)
                  }
                />
                <span>Development enquiry</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={closeEditLead}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={actionLoading}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showAddLead && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddLead();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 1000,
            overflowY: "auto",
          }}
        >
          <form
            onSubmit={createLead}
            style={{
              width: "min(900px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Add Lead</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  Create a new customer enquiry in the commercial pipeline.
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeAddLead}
                disabled={saving}
                title="Close"
              >
                ×
              </button>
            </div>

            {formError && (
              <div
                className="form-error"
                style={{
                  marginBottom: "16px",
                  padding: "10px 12px",
                }}
              >
                {formError}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              <label>
                <span>Enquiry ID *</span>
                <input
                  required
                  value={form.enquiry_id}
                  onChange={(event) =>
                    updateForm("enquiry_id", event.target.value)
                  }
                  placeholder="ENQ-1001"
                />
              </label>

              <label>
                <span>Customer *</span>
                <input
                  required
                  value={form.customer}
                  onChange={(event) =>
                    updateForm("customer", event.target.value)
                  }
                  placeholder="Customer name"
                />
              </label>

              <label>
                <span>Product *</span>
                <input
                  required
                  value={form.product}
                  onChange={(event) =>
                    updateForm("product", event.target.value)
                  }
                  placeholder="Product name"
                />
              </label>

              <label>
                <span>CAS No.</span>
                <input
                  value={form.cas_no}
                  onChange={(event) =>
                    updateForm("cas_no", event.target.value)
                  }
                  placeholder="CAS number"
                />
              </label>

              <label>
                <span>Market *</span>
                <select
                  value={form.market}
                  onChange={(event) =>
                    updateForm("market", event.target.value)
                  }
                >
                  <option value="US">US</option>
                  <option value="EU">EU</option>
                  <option value="Japan">Japan</option>
                  <option value="ROW">ROW</option>
                </select>
              </label>

              <label>
                <span>Regulatory Path</span>
                <input
                  value={form.regulatory_path}
                  onChange={(event) =>
                    updateForm("regulatory_path", event.target.value)
                  }
                  placeholder="DMF / CEP / Customer filing"
                />
              </label>

              <label>
                <span>Tech Pack *</span>
                <select
                  value={form.tech_pack}
                  onChange={(event) =>
                    updateForm("tech_pack", event.target.value)
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                </select>
              </label>

              <label>
                <span>Quantity (kg) *</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity_kg}
                  onChange={(event) =>
                    updateForm("quantity_kg", event.target.value)
                  }
                  placeholder="100"
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
                  onChange={(event) =>
                    updateForm("value_usd", event.target.value)
                  }
                  placeholder="100000"
                />
              </label>

              <label>
                <span>Stage *</span>
                <select
                  value={form.stage}
                  onChange={(event) =>
                    updateForm("stage", event.target.value)
                  }
                >
                  {STAGES.filter((item) => item !== "All").map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Owner</span>
                <input
                  value={form.owner}
                  onChange={(event) =>
                    updateForm("owner", event.target.value)
                  }
                  placeholder="Sales owner"
                />
              </label>

              <label>
                <span>Next Step</span>
                <input
                  value={form.next_step}
                  onChange={(event) =>
                    updateForm("next_step", event.target.value)
                  }
                  placeholder="Next commercial action"
                />
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  paddingTop: "25px",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.development}
                  onChange={(event) =>
                    updateForm("development", event.target.checked)
                  }
                />
                <span>Development enquiry</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "24px",
                paddingTop: "18px",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={closeAddLead}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Lead"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

