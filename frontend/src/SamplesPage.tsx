import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

type Sample = {
  id: number;
  sample_number: string;
  enquiry_id?: string | null;
  po_number?: string | null;
  customer?: string | null;
  product: string;
  cas_no?: string | null;
  batch_number?: string | null;
  sample_quantity: number;
  unit: string;
  sample_type: string;
  purpose?: string | null;
  status: string;
  priority: string;
  requested_date?: string | null;
  dispatch_date?: string | null;
  received_date?: string | null;
  dispatched_to?: string | null;
  courier?: string | null;
  tracking_number?: string | null;
  owner?: string | null;
  notes?: string | null;
};

const STATUS_OPTIONS = [
  "Requested",
  "In Preparation",
  "Ready for Dispatch",
  "Dispatched",
  "Received",
  "Testing",
  "Completed",
  "Cancelled",
];

const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Urgent"];

const emptyForm = {
  sample_number: "",
  enquiry_id: "",
  po_number: "",
  customer: "",
  product: "",
  cas_no: "",
  batch_number: "",
  sample_quantity: 0,
  unit: "g",
  sample_type: "Development",
  purpose: "",
  status: "Requested",
  priority: "Normal",
  requested_date: "",
  dispatch_date: "",
  received_date: "",
  dispatched_to: "",
  courier: "",
  tracking_number: "",
  owner: "",
  notes: "",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN");
}

function toISO(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function SamplesPage() {
  const { user } = useAuth();

  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showView, setShowView] = useState<Sample | null>(null);
  const [editing, setEditing] = useState<Sample | null>(null);

  const [form, setForm] = useState<any>(emptyForm);

  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const samplePermissions = user?.role?.permissions?.find(
    (permission: any) =>
      String(permission.page || "").toLowerCase() === "samples"
  );

  const canCreate = isAdmin || Boolean(samplePermissions?.can_create);
  const canEdit = isAdmin || Boolean(samplePermissions?.can_edit);
  const canDelete = isAdmin || Boolean(samplePermissions?.can_delete);

  const loadSamples = async () => {
    try {
      setLoading(true);

      const params: Record<string, string> = {};

      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get("/api/samples", { params });

      setSamples(response.data?.items || response.data || []);
    } catch (error: any) {
      console.error(error);
      alert(
        error?.response?.data?.detail ||
          "Unable to load samples."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, [statusFilter, priorityFilter]);

  const filteredSamples = useMemo(() => {
    if (!search.trim()) return samples;

    const q = search.toLowerCase();

    return samples.filter((sample) =>
      [
        sample.sample_number,
        sample.enquiry_id,
        sample.po_number,
        sample.customer,
        sample.product,
        sample.batch_number,
        sample.dispatched_to,
        sample.tracking_number,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(q)
        )
    );
  }, [samples, search]);

  const stats = useMemo(() => {
    return {
      total: samples.length,
      requested: samples.filter(
        (s) => s.status === "Requested"
      ).length,
      preparation: samples.filter(
        (s) => s.status === "In Preparation"
      ).length,
      dispatch: samples.filter(
        (s) => s.status === "Ready for Dispatch"
      ).length,
      testing: samples.filter(
        (s) => s.status === "Testing"
      ).length,
      completed: samples.filter(
        (s) => s.status === "Completed"
      ).length,
    };
  }, [samples]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      sample_number: `SMP-${Date.now().toString().slice(-6)}`,
    });
    setShowForm(true);
  };

  const openEdit = (sample: Sample) => {
    setEditing(sample);

    setForm({
      sample_number: sample.sample_number || "",
      enquiry_id: sample.enquiry_id || "",
      po_number: sample.po_number || "",
      customer: sample.customer || "",
      product: sample.product || "",
      cas_no: sample.cas_no || "",
      batch_number: sample.batch_number || "",
      sample_quantity: sample.sample_quantity || 0,
      unit: sample.unit || "g",
      sample_type: sample.sample_type || "Development",
      purpose: sample.purpose || "",
      status: sample.status || "Requested",
      priority: sample.priority || "Normal",
      requested_date: sample.requested_date
        ? sample.requested_date.slice(0, 16)
        : "",
      dispatch_date: sample.dispatch_date
        ? sample.dispatch_date.slice(0, 16)
        : "",
      received_date: sample.received_date
        ? sample.received_date.slice(0, 16)
        : "",
      dispatched_to: sample.dispatched_to || "",
      courier: sample.courier || "",
      tracking_number: sample.tracking_number || "",
      owner: sample.owner || "",
      notes: sample.notes || "",
    });

    setShowForm(true);
  };

  const updateField = (
    field: string,
    value: string | number
  ) => {
    setForm((prev: any) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildPayload = () => ({
    ...form,
    sample_quantity: Number(form.sample_quantity || 0),
    requested_date: toISO(form.requested_date),
    dispatch_date: toISO(form.dispatch_date),
    received_date: toISO(form.received_date),
  });

  const saveSample = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);

      const payload = buildPayload();

      if (editing) {
        await api.put(
          `/api/samples/${editing.id}`,
          payload
        );
      } else {
        await api.post("/api/samples", payload);
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);

      await loadSamples();

      alert(
        editing
          ? "Sample updated successfully."
          : "Sample created successfully."
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to save sample."
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    sample: Sample,
    status: string
  ) => {
    try {
      await api.patch(
        `/api/samples/${sample.id}/status`,
        { status }
      );

      await loadSamples();
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to update sample status."
      );
    }
  };

  const deleteSample = async (sample: Sample) => {
    if (
      !window.confirm(
        `Delete sample ${sample.sample_number}?`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/samples/${sample.id}`);
      await loadSamples();
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to delete sample."
      );
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d7dce3",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    background: "#fff",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 18,
  };

  return (
    <div
      style={{
        padding: 24,
        background: "#f7f8fa",
        minHeight: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: "#172033",
            }}
          >
            Samples
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Manage sample requests, preparation, dispatch and receipt.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            style={{
              border: 0,
              borderRadius: 8,
              padding: "11px 18px",
              background: "#172033",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Add Sample
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Total Samples
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.total}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Requested
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.requested}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            In Preparation
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.preparation}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Ready for Dispatch
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.dispatch}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Testing
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.testing}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Completed
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 5,
            }}
          >
            {stats.completed}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          ...cardStyle,
          marginBottom: 18,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadSamples();
          }}
          placeholder="Search sample, customer, product, PO..."
          style={{
            ...inputStyle,
            flex: "1 1 300px",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            ...inputStyle,
            width: 190,
            flex: "0 1 190px",
          }}
        >
          <option value="">All Statuses</option>

          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value)
          }
          style={{
            ...inputStyle,
            width: 150,
            flex: "0 1 150px",
          }}
        >
          <option value="">All Priorities</option>

          {PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>

        <button
          onClick={loadSamples}
          style={{
            padding: "10px 16px",
            border: "1px solid #d7dce3",
            borderRadius: 8,
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          ...cardStyle,
          overflowX: "auto",
          padding: 0,
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 1050,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
                textAlign: "left",
              }}
            >
              {[
                "Sample",
                "Customer",
                "Product",
                "Quantity",
                "Priority",
                "Status",
                "Requested",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "13px 14px",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: 12,
                    color: "#64748b",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 35,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Loading samples...
                </td>
              </tr>
            ) : filteredSamples.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 35,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  No samples found.
                </td>
              </tr>
            ) : (
              filteredSamples.map((sample) => (
                <tr key={sample.id}>
                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <strong>
                      {sample.sample_number}
                    </strong>

                    {sample.po_number && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginTop: 3,
                        }}
                      >
                        PO: {sample.po_number}
                      </div>
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    {sample.customer || "-"}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <strong>{sample.product}</strong>

                    {sample.batch_number && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginTop: 3,
                        }}
                      >
                        Batch: {sample.batch_number}
                      </div>
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    {sample.sample_quantity}{" "}
                    {sample.unit}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          sample.priority === "Urgent"
                            ? "#fee2e2"
                            : sample.priority === "High"
                            ? "#ffedd5"
                            : "#f1f5f9",
                        color:
                          sample.priority === "Urgent"
                            ? "#b91c1c"
                            : sample.priority === "High"
                            ? "#c2410c"
                            : "#475569",
                      }}
                    >
                      {sample.priority}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    {canEdit ? (
                      <select
                        value={sample.status}
                        onChange={(e) =>
                          changeStatus(
                            sample,
                            e.target.value
                          )
                        }
                        style={{
                          padding: "6px 8px",
                          border:
                            "1px solid #d7dce3",
                          borderRadius: 7,
                          fontSize: 12,
                          background: "#fff",
                        }}
                      >
                        {STATUS_OPTIONS.map(
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
                      sample.status
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(
                      sample.requested_date
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        onClick={() =>
                          setShowView(sample)
                        }
                        style={{
                          border:
                            "1px solid #d7dce3",
                          background: "#fff",
                          borderRadius: 7,
                          padding: "6px 9px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        View
                      </button>

                      {canEdit && (
                        <button
                          onClick={() =>
                            openEdit(sample)
                          }
                          style={{
                            border:
                              "1px solid #d7dce3",
                            background: "#fff",
                            borderRadius: 7,
                            padding: "6px 9px",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() =>
                            deleteSample(sample)
                          }
                          style={{
                            border:
                              "1px solid #fecaca",
                            background: "#fff",
                            color: "#b91c1c",
                            borderRadius: 7,
                            padding: "6px 9px",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "min(950px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0 }}>
                {editing
                  ? "Edit Sample"
                  : "Add Sample"}
              </h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveSample}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 14,
                }}
              >
                <div>
                  <label style={labelStyle}>
                    Sample Number *
                  </label>
                  <input
                    required
                    value={form.sample_number}
                    onChange={(e) =>
                      updateField(
                        "sample_number",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Enquiry ID
                  </label>
                  <input
                    value={form.enquiry_id}
                    onChange={(e) =>
                      updateField(
                        "enquiry_id",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    PO Number
                  </label>
                  <input
                    value={form.po_number}
                    onChange={(e) =>
                      updateField(
                        "po_number",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Customer
                  </label>
                  <input
                    value={form.customer}
                    onChange={(e) =>
                      updateField(
                        "customer",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Product *
                  </label>
                  <input
                    required
                    value={form.product}
                    onChange={(e) =>
                      updateField(
                        "product",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    CAS No.
                  </label>
                  <input
                    value={form.cas_no}
                    onChange={(e) =>
                      updateField(
                        "cas_no",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Batch Number
                  </label>
                  <input
                    value={form.batch_number}
                    onChange={(e) =>
                      updateField(
                        "batch_number",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Sample Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sample_quantity}
                    onChange={(e) =>
                      updateField(
                        "sample_quantity",
                        Number(e.target.value)
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Unit
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) =>
                      updateField(
                        "unit",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Sample Type
                  </label>
                  <select
                    value={form.sample_type}
                    onChange={(e) =>
                      updateField(
                        "sample_type",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option>Development</option>
                    <option>Commercial</option>
                    <option>Stability</option>
                    <option>Reference</option>
                    <option>Regulatory</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) =>
                      updateField(
                        "priority",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {PRIORITY_OPTIONS.map(
                      (priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {priority}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      updateField(
                        "status",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {STATUS_OPTIONS.map(
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

                <div>
                  <label style={labelStyle}>
                    Requested Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.requested_date}
                    onChange={(e) =>
                      updateField(
                        "requested_date",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Dispatch Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.dispatch_date}
                    onChange={(e) =>
                      updateField(
                        "dispatch_date",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Received Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.received_date}
                    onChange={(e) =>
                      updateField(
                        "received_date",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Dispatched To
                  </label>
                  <input
                    value={form.dispatched_to}
                    onChange={(e) =>
                      updateField(
                        "dispatched_to",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Courier
                  </label>
                  <input
                    value={form.courier}
                    onChange={(e) =>
                      updateField(
                        "courier",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Tracking Number
                  </label>
                  <input
                    value={form.tracking_number}
                    onChange={(e) =>
                      updateField(
                        "tracking_number",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Owner
                  </label>
                  <input
                    value={form.owner}
                    onChange={(e) =>
                      updateField(
                        "owner",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <label style={labelStyle}>
                    Purpose
                  </label>
                  <input
                    value={form.purpose}
                    onChange={(e) =>
                      updateField(
                        "purpose",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <label style={labelStyle}>
                    Notes
                  </label>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(e) =>
                      updateField(
                        "notes",
                        e.target.value
                      )
                    }
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 22,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "10px 18px",
                    border:
                      "1px solid #d7dce3",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 20px",
                    border: 0,
                    borderRadius: 8,
                    background: "#172033",
                    color: "#fff",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editing
                    ? "Update Sample"
                    : "Create Sample"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showView && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "min(760px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {showView.sample_number}
                </h2>

                <div
                  style={{
                    color: "#64748b",
                    marginTop: 4,
                  }}
                >
                  {showView.product}
                </div>
              </div>

              <button
                onClick={() => setShowView(null)}
                style={{
                  border: 0,
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 14,
                marginTop: 22,
              }}
            >
              {[
                ["Customer", showView.customer],
                ["Enquiry ID", showView.enquiry_id],
                ["PO Number", showView.po_number],
                ["Product", showView.product],
                ["CAS No.", showView.cas_no],
                ["Batch Number", showView.batch_number],
                [
                  "Quantity",
                  `${showView.sample_quantity} ${showView.unit}`,
                ],
                ["Sample Type", showView.sample_type],
                ["Purpose", showView.purpose],
                ["Status", showView.status],
                ["Priority", showView.priority],
                [
                  "Requested",
                  formatDate(showView.requested_date),
                ],
                [
                  "Dispatched",
                  formatDate(showView.dispatch_date),
                ],
                [
                  "Received",
                  formatDate(showView.received_date),
                ],
                ["Dispatched To", showView.dispatched_to],
                ["Courier", showView.courier],
                [
                  "Tracking Number",
                  showView.tracking_number,
                ],
                ["Owner", showView.owner],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: 12,
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 9,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      marginBottom: 4,
                    }}
                  >
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {value || "-"}
                  </div>
                </div>
              ))}
            </div>

            {showView.notes && (
              <div
                style={{
                  marginTop: 15,
                  padding: 14,
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 9,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    marginBottom: 5,
                  }}
                >
                  Notes
                </div>

                <div style={{ fontSize: 14 }}>
                  {showView.notes}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setShowView(null)}
                style={{
                  padding: "10px 18px",
                  border:
                    "1px solid #d7dce3",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                }}
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