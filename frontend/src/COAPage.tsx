import React, { useEffect, useState } from "react";
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "./api";
import { useAuth } from "./auth";

type COA = {
  id: number;
  coa_number: string;
  po_number?: string | null;
  customer?: string | null;
  product: string;
  cas_no?: string | null;
  batch_number: string;
  quantity_kg: number;
  test_status: string;
  coa_status: string;
  qc_approved: boolean;
  qa_approved: boolean;
  test_date?: string | null;
  release_date?: string | null;
  tested_by?: string | null;
  approved_by?: string | null;
  document_reference?: string | null;
  remarks?: string | null;
};

const TEST_STATUSES = [
  "Pending",
  "In Testing",
  "Passed",
  "Failed",
];

const COA_STATUSES = [
  "Draft",
  "Testing",
  "QC Approved",
  "QA Approved",
  "Released",
  "Rejected",
];

const emptyForm = {
  coa_number: "",
  po_number: "",
  customer: "",
  product: "",
  cas_no: "",
  batch_number: "",
  quantity_kg: "",
  test_status: "Pending",
  coa_status: "Draft",
  qc_approved: false,
  qa_approved: false,
  test_date: "",
  release_date: "",
  tested_by: "",
  approved_by: "",
  document_reference: "",
  remarks: "",
};

function dateText(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function COAPage() {
  const { user } = useAuth();
  const isAdmin =
    user?.role?.name === "Plant Head / Admin";

  const [items, setItems] = useState<COA[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewItem, setViewItem] = useState<COA | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (testFilter) params.test_status = testFilter;
      if (statusFilter) params.coa_status = statusFilter;

      const [list, stats] = await Promise.all([
        api.get("/api/coa", { params }),
        api.get("/api/coa/summary"),
      ]);

      setItems(list.data?.items || list.data || []);
      setSummary(stats.data || {});
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Unable to load COA data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [search, testFilter, statusFilter]);

  function field(name: string, value: any) {
    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEdit(item: COA) {
    setEditingId(item.id);

    setForm({
      coa_number: item.coa_number || "",
      po_number: item.po_number || "",
      customer: item.customer || "",
      product: item.product || "",
      cas_no: item.cas_no || "",
      batch_number: item.batch_number || "",
      quantity_kg: String(item.quantity_kg ?? ""),
      test_status: item.test_status || "Pending",
      coa_status: item.coa_status || "Draft",
      qc_approved: item.qc_approved,
      qa_approved: item.qa_approved,
      test_date: item.test_date
        ? item.test_date.slice(0, 16)
        : "",
      release_date: item.release_date
        ? item.release_date.slice(0, 16)
        : "",
      tested_by: item.tested_by || "",
      approved_by: item.approved_by || "",
      document_reference:
        item.document_reference || "",
      remarks: item.remarks || "",
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function saveCOA(e: React.FormEvent) {
    e.preventDefault();

    try {
      setError("");
      setMessage("");

      const payload = {
        coa_number: form.coa_number.trim(),
        po_number: form.po_number || null,
        customer: form.customer || null,
        product: form.product.trim(),
        cas_no: form.cas_no || null,
        batch_number: form.batch_number.trim(),
        quantity_kg: Number(form.quantity_kg || 0),
        test_status: form.test_status,
        coa_status: form.coa_status,
        qc_approved: form.qc_approved,
        qa_approved: form.qa_approved,
        test_date: form.test_date || null,
        release_date: form.release_date || null,
        tested_by: form.tested_by || null,
        approved_by: form.approved_by || null,
        document_reference:
          form.document_reference || null,
        remarks: form.remarks || null,
      };

      if (editingId) {
        await api.put(
          `/api/coa/${editingId}`,
          payload
        );
        setMessage("COA updated successfully.");
      } else {
        await api.post("/api/coa", payload);
        setMessage("COA created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Unable to save COA."
      );
    }
  }

  async function changeStatus(
    item: COA,
    status: string
  ) {
    try {
      await api.patch(
        `/api/coa/${item.id}/status`,
        null,
        { params: { status } }
      );

      setMessage(
        `${item.coa_number} status updated.`
      );

      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Unable to update status."
      );
    }
  }

  async function deleteCOA(item: COA) {
    if (
      !window.confirm(
        `Delete COA ${item.coa_number}?`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/coa/${item.id}`);
      setMessage("COA deleted successfully.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Unable to delete COA."
      );
    }
  }

  return (
    <div className="coa-page">
      <style>{`
        .coa-page {
          padding: 24px;
          color: #172033;
        }

        .coa-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 22px;
        }

        .coa-title {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .coa-subtitle {
          margin: 6px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .actions {
          display: flex;
          gap: 9px;
        }

        .btn {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .primary {
          background: #111827;
          color: white;
        }

        .secondary {
          background: white;
          border: 1px solid #d0d5dd;
          color: #344054;
        }

        .kpis {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }

        .kpi {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 16px;
        }

        .kpi-label {
          color: #667085;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .kpi-value {
          font-size: 25px;
          font-weight: 800;
          margin-top: 7px;
        }

        .filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 13px;
          margin-bottom: 16px;
        }

        .search {
          position: relative;
          flex: 1;
          min-width: 240px;
        }

        .search svg {
          position: absolute;
          left: 10px;
          top: 11px;
          color: #98a2b3;
        }

        input,
        select,
        textarea {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 10px 12px;
          background: white;
        }

        .search input {
          padding-left: 34px;
        }

        .filter-select {
          width: 180px;
        }

        .table-box {
          background: white;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1000px;
          border-collapse: collapse;
        }

        th,
        td {
          padding: 13px;
          border-bottom: 1px solid #eaecf0;
          text-align: left;
          font-size: 13px;
          white-space: nowrap;
        }

        th {
          background: #f9fafb;
          color: #667085;
          font-size: 11px;
          text-transform: uppercase;
        }

        .badge {
          display: inline-flex;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }

        .green {
          background: #ecfdf3;
          color: #027a48;
        }

        .yellow {
          background: #fffaeb;
          color: #b54708;
        }

        .red {
          background: #fef3f2;
          color: #b42318;
        }

        .gray {
          background: #f2f4f7;
          color: #475467;
        }

        .icon-btn {
          border: 1px solid #d0d5dd;
          background: white;
          border-radius: 7px;
          padding: 7px;
          cursor: pointer;
        }

        .row-actions {
          display: flex;
          gap: 6px;
        }

        .empty {
          padding: 50px;
          text-align: center;
          color: #667085;
        }

        .alert {
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 600;
        }

        .success {
          background: #ecfdf3;
          color: #027a48;
        }

        .error {
          background: #fef3f2;
          color: #b42318;
        }

        .backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(16,24,40,.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(850px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 14px;
        }

        .modal-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #eaecf0;
        }

        .modal-head h3 {
          margin: 0;
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

        .full {
          grid-column: 1 / -1;
        }

        .label {
          font-size: 12px;
          font-weight: 700;
          color: #344054;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          padding: 16px 20px;
          border-top: 1px solid #eaecf0;
        }

        .details {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .detail {
          background: #f9fafb;
          border-radius: 8px;
          padding: 12px;
        }

        .detail small {
          display: block;
          color: #667085;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
        }

        .detail strong {
          display: block;
          margin-top: 4px;
        }

        @media(max-width:1000px) {
          .kpis {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media(max-width:650px) {
          .coa-page {
            padding: 14px;
          }

          .coa-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .actions {
            width: 100%;
          }

          .actions .btn {
            flex: 1;
            justify-content: center;
          }

          .kpis {
            grid-template-columns: repeat(2, 1fr);
          }

          .form-grid,
          .details {
            grid-template-columns: 1fr;
          }

          .full {
            grid-column: auto;
          }
        }
      `}</style>

      <div className="coa-header">
        <div>
          <h1 className="coa-title">COA</h1>
          <p className="coa-subtitle">
            Certificate of Analysis, QC approval and batch release.
          </p>
        </div>

        <div className="actions">
          <button
            className="btn secondary"
            onClick={loadData}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          {isAdmin && (
            <button
              className="btn primary"
              onClick={openCreate}
            >
              <Plus size={16} />
              Add COA
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">Total COAs</div>
          <div className="kpi-value">
            {summary.total || 0}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Pending Tests</div>
          <div className="kpi-value">
            {summary.pending || 0}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">In Testing</div>
          <div className="kpi-value">
            {summary.testing || 0}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">QC Pending</div>
          <div className="kpi-value">
            {summary.qc_pending || 0}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Released</div>
          <div className="kpi-value">
            {summary.released || 0}
          </div>
        </div>
      </div>

      <div className="filters">
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Search COA, PO, customer, product, batch..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />
        </div>

        <select
          className="filter-select"
          value={testFilter}
          onChange={(e) =>
            setTestFilter(e.target.value)
          }
        >
          <option value="">All Test Status</option>
          {TEST_STATUSES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>

        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
        >
          <option value="">All COA Status</option>
          {COA_STATUSES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>

      <div className="table-box">
        {loading ? (
          <div className="empty">
            Loading COA data...
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            No COA records found.
            {isAdmin && (
              <div>
                <button
                  className="btn primary"
                  style={{ marginTop: 14 }}
                  onClick={openCreate}
                >
                  <Plus size={16} />
                  Add First COA
                </button>
              </div>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>COA</th>
                <th>PO</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Quantity</th>
                <th>Test</th>
                <th>Status</th>
                <th>QC</th>
                <th>QA</th>
                <th>Release</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.coa_number}
                    </strong>
                  </td>

                  <td>{item.po_number || "-"}</td>

                  <td>{item.customer || "-"}</td>

                  <td>{item.product}</td>

                  <td>{item.batch_number}</td>

                  <td>
                    {item.quantity_kg.toLocaleString()} kg
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        item.test_status === "Passed"
                          ? "green"
                          : item.test_status === "Failed"
                          ? "red"
                          : item.test_status === "In Testing"
                          ? "yellow"
                          : "gray"
                      }`}
                    >
                      {item.test_status}
                    </span>
                  </td>

                  <td>
                    {isAdmin ? (
                      <select
                        value={item.coa_status}
                        onChange={(e) =>
                          changeStatus(
                            item,
                            e.target.value
                          )
                        }
                        style={{
                          width: 150,
                          padding: 6,
                        }}
                      >
                        {COA_STATUSES.map((x) => (
                          <option
                            key={x}
                            value={x}
                          >
                            {x}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge gray">
                        {item.coa_status}
                      </span>
                    )}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        item.qc_approved
                          ? "green"
                          : "yellow"
                      }`}
                    >
                      {item.qc_approved
                        ? "Approved"
                        : "Pending"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        item.qa_approved
                          ? "green"
                          : "yellow"
                      }`}
                    >
                      {item.qa_approved
                        ? "Approved"
                        : "Pending"}
                    </span>
                  </td>

                  <td>
                    {dateText(item.release_date)}
                  </td>

                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        title="View"
                        onClick={() => {
                          setViewItem(item);
                          setShowView(true);
                        }}
                      >
                        <Eye size={15} />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            className="icon-btn"
                            title="Edit"
                            onClick={() =>
                              openEdit(item)
                            }
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            className="icon-btn"
                            title="Delete"
                            onClick={() =>
                              deleteCOA(item)
                            }
                          >
                            <Trash2 size={15} />
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
        <div className="backdrop">
          <form
            className="modal"
            onSubmit={saveCOA}
          >
            <div className="modal-head">
              <h3>
                {editingId
                  ? "Edit COA"
                  : "Add COA"}
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
                  <label className="label">
                    COA Number *
                  </label>
                  <input
                    required
                    value={form.coa_number}
                    onChange={(e) =>
                      field(
                        "coa_number",
                        e.target.value
                      )
                    }
                    placeholder="COA-0001"
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    PO Number
                  </label>
                  <input
                    value={form.po_number}
                    onChange={(e) =>
                      field(
                        "po_number",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Customer
                  </label>
                  <input
                    value={form.customer}
                    onChange={(e) =>
                      field(
                        "customer",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Product *
                  </label>
                  <input
                    required
                    value={form.product}
                    onChange={(e) =>
                      field(
                        "product",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    CAS No.
                  </label>
                  <input
                    value={form.cas_no}
                    onChange={(e) =>
                      field(
                        "cas_no",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Batch Number *
                  </label>
                  <input
                    required
                    value={form.batch_number}
                    onChange={(e) =>
                      field(
                        "batch_number",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Quantity (kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity_kg}
                    onChange={(e) =>
                      field(
                        "quantity_kg",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Test Status
                  </label>
                  <select
                    value={form.test_status}
                    onChange={(e) =>
                      field(
                        "test_status",
                        e.target.value
                      )
                    }
                  >
                    {TEST_STATUSES.map((x) => (
                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">
                    COA Status
                  </label>
                  <select
                    value={form.coa_status}
                    onChange={(e) =>
                      field(
                        "coa_status",
                        e.target.value
                      )
                    }
                  >
                    {COA_STATUSES.map((x) => (
                      <option
                        key={x}
                        value={x}
                      >
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">
                    Test Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.test_date}
                    onChange={(e) =>
                      field(
                        "test_date",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Release Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.release_date}
                    onChange={(e) =>
                      field(
                        "release_date",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Tested By
                  </label>
                  <input
                    value={form.tested_by}
                    onChange={(e) =>
                      field(
                        "tested_by",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Approved By
                  </label>
                  <input
                    value={form.approved_by}
                    onChange={(e) =>
                      field(
                        "approved_by",
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    Document Reference
                  </label>
                  <input
                    value={
                      form.document_reference
                    }
                    onChange={(e) =>
                      field(
                        "document_reference",
                        e.target.value
                      )
                    }
                    placeholder="COA document/path/reference"
                  />
                </div>

                <div className="form-group">
                  <label className="label">
                    QC Approved
                  </label>
                  <select
                    value={
                      form.qc_approved
                        ? "true"
                        : "false"
                    }
                    onChange={(e) =>
                      field(
                        "qc_approved",
                        e.target.value === "true"
                      )
                    }
                  >
                    <option value="false">
                      Pending
                    </option>
                    <option value="true">
                      Approved
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">
                    QA Approved
                  </label>
                  <select
                    value={
                      form.qa_approved
                        ? "true"
                        : "false"
                    }
                    onChange={(e) =>
                      field(
                        "qa_approved",
                        e.target.value === "true"
                      )
                    }
                  >
                    <option value="false">
                      Pending
                    </option>
                    <option value="true">
                      Approved
                    </option>
                  </select>
                </div>

                <div className="form-group full">
                  <label className="label">
                    Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={form.remarks}
                    onChange={(e) =>
                      field(
                        "remarks",
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
                className="btn secondary"
                onClick={() =>
                  setShowForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn primary"
              >
                {editingId
                  ? "Update COA"
                  : "Create COA"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showView && viewItem && (
        <div className="backdrop">
          <div className="modal">
            <div className="modal-head">
              <h3>
                {viewItem.coa_number}
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
              <div className="details">
                <div className="detail">
                  <small>COA Number</small>
                  <strong>
                    {viewItem.coa_number}
                  </strong>
                </div>

                <div className="detail">
                  <small>PO Number</small>
                  <strong>
                    {viewItem.po_number || "-"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Customer</small>
                  <strong>
                    {viewItem.customer || "-"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Product</small>
                  <strong>
                    {viewItem.product}
                  </strong>
                </div>

                <div className="detail">
                  <small>CAS Number</small>
                  <strong>
                    {viewItem.cas_no || "-"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Batch</small>
                  <strong>
                    {viewItem.batch_number}
                  </strong>
                </div>

                <div className="detail">
                  <small>Quantity</small>
                  <strong>
                    {viewItem.quantity_kg.toLocaleString()} kg
                  </strong>
                </div>

                <div className="detail">
                  <small>Test Status</small>
                  <strong>
                    {viewItem.test_status}
                  </strong>
                </div>

                <div className="detail">
                  <small>COA Status</small>
                  <strong>
                    {viewItem.coa_status}
                  </strong>
                </div>

                <div className="detail">
                  <small>QC Approval</small>
                  <strong>
                    {viewItem.qc_approved
                      ? "Approved"
                      : "Pending"}
                  </strong>
                </div>

                <div className="detail">
                  <small>QA Approval</small>
                  <strong>
                    {viewItem.qa_approved
                      ? "Approved"
                      : "Pending"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Test Date</small>
                  <strong>
                    {dateText(
                      viewItem.test_date
                    )}
                  </strong>
                </div>

                <div className="detail">
                  <small>Release Date</small>
                  <strong>
                    {dateText(
                      viewItem.release_date
                    )}
                  </strong>
                </div>

                <div className="detail">
                  <small>Tested By</small>
                  <strong>
                    {viewItem.tested_by || "-"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Approved By</small>
                  <strong>
                    {viewItem.approved_by || "-"}
                  </strong>
                </div>

                <div className="detail">
                  <small>Document</small>
                  <strong>
                    {viewItem.document_reference ||
                      "-"}
                  </strong>
                </div>

                <div
                  className="detail"
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <small>Remarks</small>
                  <strong>
                    {viewItem.remarks || "-"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn secondary"
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