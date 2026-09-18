import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

type Quote = {
  id: number;
  quote_number: string;
  enquiry_id?: string | null;
  customer: string;
  product: string;
  cas_no?: string | null;
  quantity_kg: number;
  unit_price_usd: number;
  total_value_usd: number;
  currency: string;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  validity_days: number;
  status: string;
  quote_date?: string | null;
  valid_until?: string | null;
  owner?: string | null;
  notes?: string | null;
};

const STATUSES = [
  "Draft",
  "Sent",
  "Negotiation",
  "Accepted",
  "Rejected",
  "Expired",
  "Converted to PO",
  "Cancelled",
];

const emptyForm = {
  quote_number: "",
  enquiry_id: "",
  customer: "",
  product: "",
  cas_no: "",
  quantity_kg: 0,
  unit_price_usd: 0,
  currency: "USD",
  payment_terms: "",
  delivery_terms: "",
  validity_days: 30,
  status: "Draft",
  quote_date: "",
  valid_until: "",
  owner: "",
  notes: "",
};

function formatMoney(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN");
}

function toISO(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function QuotesPage() {
  const { user } = useAuth();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [viewQuote, setViewQuote] = useState<Quote | null>(null);
  const [editing, setEditing] = useState<Quote | null>(null);

  const [form, setForm] = useState<any>(emptyForm);

  const isAdmin = user?.role?.name === "Plant Head / Admin";

  const permissions = user?.role?.permissions?.find(
    (permission: any) =>
      String(permission.page || "").toLowerCase() === "quotes"
  );

  const canCreate =
    isAdmin || Boolean(permissions?.can_create);

  const canEdit =
    isAdmin || Boolean(permissions?.can_edit);

  const canDelete =
    isAdmin || Boolean(permissions?.can_delete);

  const loadQuotes = async () => {
    try {
      setLoading(true);

      const params: Record<string, string> = {};

      if (search.trim()) {
        params.search = search.trim();
      }

      if (statusFilter) {
        params.status = statusFilter;
      }

      const response = await api.get("/api/quotes", {
        params,
      });

      setQuotes(
        response.data?.items ||
          response.data ||
          []
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to load quotes."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, [statusFilter]);

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;

    const q = search.toLowerCase();

    return quotes.filter((quote) =>
      [
        quote.quote_number,
        quote.enquiry_id,
        quote.customer,
        quote.product,
        quote.cas_no,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(q)
        )
    );
  }, [quotes, search]);

  const stats = useMemo(() => {
    const totalValue = quotes.reduce(
      (sum, quote) =>
        sum + Number(quote.total_value_usd || 0),
      0
    );

    const acceptedValue = quotes
      .filter(
        (quote) => quote.status === "Accepted"
      )
      .reduce(
        (sum, quote) =>
          sum + Number(quote.total_value_usd || 0),
        0
      );

    return {
      total: quotes.length,
      totalValue,
      sent: quotes.filter(
        (q) => q.status === "Sent"
      ).length,
      negotiation: quotes.filter(
        (q) => q.status === "Negotiation"
      ).length,
      accepted: quotes.filter(
        (q) => q.status === "Accepted"
      ).length,
      converted: quotes.filter(
        (q) => q.status === "Converted to PO"
      ).length,
      acceptedValue,
    };
  }, [quotes]);

  const updateField = (
    field: string,
    value: string | number
  ) => {
    setForm((previous: any) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openCreate = () => {
    setEditing(null);

    setForm({
      ...emptyForm,
      quote_number: `QT-${Date.now()
        .toString()
        .slice(-6)}`,
      quote_date: new Date()
        .toISOString()
        .slice(0, 16),
    });

    setShowForm(true);
  };

  const openEdit = (quote: Quote) => {
    setEditing(quote);

    setForm({
      quote_number: quote.quote_number || "",
      enquiry_id: quote.enquiry_id || "",
      customer: quote.customer || "",
      product: quote.product || "",
      cas_no: quote.cas_no || "",
      quantity_kg: quote.quantity_kg || 0,
      unit_price_usd: quote.unit_price_usd || 0,
      currency: quote.currency || "USD",
      payment_terms: quote.payment_terms || "",
      delivery_terms: quote.delivery_terms || "",
      validity_days: quote.validity_days || 30,
      status: quote.status || "Draft",
      quote_date: quote.quote_date
        ? quote.quote_date.slice(0, 16)
        : "",
      valid_until: quote.valid_until
        ? quote.valid_until.slice(0, 16)
        : "",
      owner: quote.owner || "",
      notes: quote.notes || "",
    });

    setShowForm(true);
  };

  const calculatedTotal =
    Number(form.quantity_kg || 0) *
    Number(form.unit_price_usd || 0);

  const saveQuote = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    try {
      setSaving(true);

      const payload = {
        quote_number: form.quote_number,
        enquiry_id: form.enquiry_id || null,
        customer: form.customer,
        product: form.product,
        cas_no: form.cas_no || null,
        quantity_kg: Number(form.quantity_kg || 0),
        unit_price_usd: Number(
          form.unit_price_usd || 0
        ),
        total_value_usd: calculatedTotal,
        currency: form.currency,
        payment_terms:
          form.payment_terms || null,
        delivery_terms:
          form.delivery_terms || null,
        validity_days: Number(
          form.validity_days || 30
        ),
        status: form.status,
        quote_date: toISO(form.quote_date),
        valid_until: toISO(form.valid_until),
        owner: form.owner || null,
        notes: form.notes || null,
      };

      if (editing) {
        await api.put(
          `/api/quotes/${editing.id}`,
          payload
        );
      } else {
        await api.post(
          "/api/quotes",
          payload
        );
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);

      await loadQuotes();

      alert(
        editing
          ? "Quote updated successfully."
          : "Quote created successfully."
      );
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to save quote."
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    quote: Quote,
    status: string
  ) => {
    try {
      await api.patch(
        `/api/quotes/${quote.id}/status`,
        null,
        {
          params: { status },
        }
      );

      await loadQuotes();
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to change quote status."
      );
    }
  };

  const deleteQuote = async (quote: Quote) => {
    if (
      !window.confirm(
        `Delete quote ${quote.quote_number}?`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/api/quotes/${quote.id}`
      );

      await loadQuotes();
    } catch (error: any) {
      console.error(error);

      alert(
        error?.response?.data?.detail ||
          "Unable to delete quote."
      );
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d7dce3",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    boxSizing: "border-box",
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
            Quotes
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Manage commercial quotations and customer negotiations.
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
            + Create Quote
          </button>
        )}
      </div>

      {/* KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(160px,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Total Quotes
          </div>
          <div style={{ fontSize: 25, fontWeight: 700 }}>
            {stats.total}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Quote Value
          </div>
          <div style={{ fontSize: 23, fontWeight: 700 }}>
            {formatMoney(stats.totalValue)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Sent
          </div>
          <div style={{ fontSize: 25, fontWeight: 700 }}>
            {stats.sent}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Negotiation
          </div>
          <div style={{ fontSize: 25, fontWeight: 700 }}>
            {stats.negotiation}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Accepted
          </div>
          <div style={{ fontSize: 25, fontWeight: 700 }}>
            {stats.accepted}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Converted to PO
          </div>
          <div style={{ fontSize: 25, fontWeight: 700 }}>
            {stats.converted}
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
          onChange={(e) =>
            setSearch(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              loadQuotes();
            }
          }}
          placeholder="Search quote, customer, product..."
          style={{
            ...inputStyle,
            flex: "1 1 300px",
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value)
          }
          style={{
            ...inputStyle,
            width: 190,
          }}
        >
          <option value="">
            All Statuses
          </option>

          {STATUSES.map((status) => (
            <option
              key={status}
              value={status}
            >
              {status}
            </option>
          ))}
        </select>

        <button
          onClick={loadQuotes}
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
          padding: 0,
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 1100,
            borderCollapse: "collapse",
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
                "Quote",
                "Customer",
                "Product",
                "Quantity",
                "Value",
                "Status",
                "Valid Until",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  style={{
                    padding: "13px 14px",
                    borderBottom:
                      "1px solid #e5e7eb",
                    fontSize: 12,
                    color: "#64748b",
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
                  }}
                >
                  Loading quotes...
                </td>
              </tr>
            ) : filteredQuotes.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    padding: 35,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  No quotes found.
                </td>
              </tr>
            ) : (
              filteredQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <strong>
                      {quote.quote_number}
                    </strong>

                    {quote.enquiry_id && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          marginTop: 3,
                        }}
                      >
                        {quote.enquiry_id}
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
                    {quote.customer}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    <strong>
                      {quote.product}
                    </strong>

                    {quote.cas_no && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                        }}
                      >
                        CAS: {quote.cas_no}
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
                    {Number(
                      quote.quantity_kg
                    ).toLocaleString()}{" "}
                    kg
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatMoney(
                      quote.total_value_usd
                    )}
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
                        value={quote.status}
                        onChange={(e) =>
                          changeStatus(
                            quote,
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
                        {STATUSES.map(
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
                      quote.status
                    )}
                  </td>

                  <td
                    style={{
                      padding: "13px 14px",
                      borderBottom:
                        "1px solid #f0f2f5",
                    }}
                  >
                    {formatDate(
                      quote.valid_until
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
                          setViewQuote(quote)
                        }
                        style={{
                          padding: "6px 9px",
                          border:
                            "1px solid #d7dce3",
                          borderRadius: 7,
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        View
                      </button>

                      {canEdit && (
                        <button
                          onClick={() =>
                            openEdit(quote)
                          }
                          style={{
                            padding: "6px 9px",
                            border:
                              "1px solid #d7dce3",
                            borderRadius: 7,
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          onClick={() =>
                            deleteQuote(quote)
                          }
                          style={{
                            padding: "6px 9px",
                            border:
                              "1px solid #fecaca",
                            borderRadius: 7,
                            background: "#fff",
                            color: "#b91c1c",
                            cursor: "pointer",
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

      {/* Create/Edit Modal */}
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
              width: "min(900px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0 }}>
                {editing
                  ? "Edit Quote"
                  : "Create Quote"}
              </h2>

              <button
                onClick={() =>
                  setShowForm(false)
                }
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

            <form onSubmit={saveQuote}>
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
                    Quote Number *
                  </label>

                  <input
                    required
                    value={form.quote_number}
                    onChange={(e) =>
                      updateField(
                        "quote_number",
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
                    Customer *
                  </label>

                  <input
                    required
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
                    Quantity (kg)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.quantity_kg}
                    onChange={(e) =>
                      updateField(
                        "quantity_kg",
                        Number(e.target.value)
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Unit Price (USD/kg)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price_usd}
                    onChange={(e) =>
                      updateField(
                        "unit_price_usd",
                        Number(e.target.value)
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Currency
                  </label>

                  <select
                    value={form.currency}
                    onChange={(e) =>
                      updateField(
                        "currency",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option>USD</option>
                    <option>EUR</option>
                    <option>INR</option>
                    <option>GBP</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Validity (days)
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={form.validity_days}
                    onChange={(e) =>
                      updateField(
                        "validity_days",
                        Number(e.target.value)
                      )
                    }
                    style={inputStyle}
                  />
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
                    {STATUSES.map(
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
                    Quote Date
                  </label>

                  <input
                    type="datetime-local"
                    value={form.quote_date}
                    onChange={(e) =>
                      updateField(
                        "quote_date",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Valid Until
                  </label>

                  <input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) =>
                      updateField(
                        "valid_until",
                        e.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Payment Terms
                  </label>

                  <input
                    value={form.payment_terms}
                    onChange={(e) =>
                      updateField(
                        "payment_terms",
                        e.target.value
                      )
                    }
                    placeholder="e.g. 30% advance, balance on dispatch"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Delivery Terms
                  </label>

                  <input
                    value={form.delivery_terms}
                    onChange={(e) =>
                      updateField(
                        "delivery_terms",
                        e.target.value
                      )
                    }
                    placeholder="e.g. Ex-Works / CIF"
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
                    padding: 12,
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    Calculated Quote Value
                  </div>

                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      marginTop: 5,
                    }}
                  >
                    {formatMoney(
                      calculatedTotal
                    )}
                  </div>
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
                  onClick={() =>
                    setShowForm(false)
                  }
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
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editing
                    ? "Update Quote"
                    : "Create Quote"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewQuote && (
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
              width: "min(760px,100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 14,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {viewQuote.quote_number}
                </h2>

                <div
                  style={{
                    color: "#64748b",
                    marginTop: 5,
                  }}
                >
                  {viewQuote.customer}
                </div>
              </div>

              <button
                onClick={() =>
                  setViewQuote(null)
                }
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
                gap: 12,
                marginTop: 22,
              }}
            >
              {[
                ["Enquiry ID", viewQuote.enquiry_id],
                ["Customer", viewQuote.customer],
                ["Product", viewQuote.product],
                ["CAS No.", viewQuote.cas_no],
                [
                  "Quantity",
                  `${viewQuote.quantity_kg} kg`,
                ],
                [
                  "Unit Price",
                  formatMoney(
                    viewQuote.unit_price_usd
                  ),
                ],
                [
                  "Total Value",
                  formatMoney(
                    viewQuote.total_value_usd
                  ),
                ],
                ["Currency", viewQuote.currency],
                [
                  "Payment Terms",
                  viewQuote.payment_terms,
                ],
                [
                  "Delivery Terms",
                  viewQuote.delivery_terms,
                ],
                [
                  "Validity",
                  `${viewQuote.validity_days} days`,
                ],
                ["Status", viewQuote.status],
                [
                  "Quote Date",
                  formatDate(
                    viewQuote.quote_date
                  ),
                ],
                [
                  "Valid Until",
                  formatDate(
                    viewQuote.valid_until
                  ),
                ],
                ["Owner", viewQuote.owner],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 9,
                    padding: 12,
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

            {viewQuote.notes && (
              <div
                style={{
                  marginTop: 14,
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 9,
                  padding: 14,
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

                {viewQuote.notes}
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
                onClick={() =>
                  setViewQuote(null)
                }
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