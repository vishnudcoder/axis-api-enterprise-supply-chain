import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api";

type Lead = {
  id: number;
  enquiry_id: string;
  customer: string;
  product: string;
  market: string;
  quantity_kg: number;
  value_usd: number;
  stage: string;
  owner?: string | null;
};

type Quote = {
  id: number;
  quote_number: string;
  customer: string;
  product: string;
  quantity_kg: number;
  total_value_usd: number;
  status: string;
};

type PO = {
  id: number;
  po_number: string;
  customer: string;
  product: string;
  quantity_kg: number;
  value_usd: number;
  status: string;
};

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function MDCommercialPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      const [leadResponse, quoteResponse, poResponse] =
        await Promise.all([
          api.get("/api/leads"),
          api.get("/api/quotes"),
          api.get("/api/purchase-orders"),
        ]);

      setLeads(
        leadResponse.data?.items ||
          leadResponse.data ||
          []
      );

      setQuotes(
        quoteResponse.data?.items ||
          quoteResponse.data ||
          []
      );

      setOrders(
        poResponse.data?.items ||
          poResponse.data ||
          []
      );
    } catch (error) {
      console.error("MD Commercial View error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const pipeline = leads.reduce(
      (sum, lead) =>
        sum + Number(lead.value_usd || 0),
      0
    );

    const quoteValue = quotes.reduce(
      (sum, quote) =>
        sum + Number(quote.total_value_usd || 0),
      0
    );

    const acceptedValue = quotes
      .filter((quote) => quote.status === "Accepted")
      .reduce(
        (sum, quote) =>
          sum + Number(quote.total_value_usd || 0),
        0
      );

    const orderValue = orders.reduce(
      (sum, order) =>
        sum + Number(order.value_usd || 0),
      0
    );

    return {
      enquiries: leads.length,
      pipeline,
      quotes: quotes.length,
      quoteValue,
      acceptedValue,
      orders: orders.length,
      orderValue,
    };
  }, [leads, quotes, orders]);

  const stageData = useMemo(() => {
    const stages = [
      "Lead",
      "COA Shared",
      "Sample Sent",
      "Quote Sent",
      "PO Received",
    ];

    return stages.map((stage) => {
      const matching = leads.filter(
        (lead) => lead.stage === stage
      );

      return {
        stage,
        count: matching.length,
        value: matching.reduce(
          (sum, lead) =>
            sum + Number(lead.value_usd || 0),
          0
        ),
      };
    });
  }, [leads]);

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
          flexWrap: "wrap",
          gap: 15,
          marginBottom: 22,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 700,
              color: "#172033",
            }}
          >
            MD Commercial View
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Executive view of commercial pipeline,
            quotations and confirmed orders.
          </p>
        </div>

        <button
          onClick={loadData}
          style={{
            border: "1px solid #d7dce3",
            borderRadius: 8,
            padding: "10px 16px",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(190px,1fr))",
          gap: 15,
          marginBottom: 20,
        }}
      >
        <div style={card}>
          <div style={label}>
            Active Enquiries
          </div>

          <div style={number}>
            {loading ? "—" : metrics.enquiries}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Pipeline Value
          </div>

          <div style={number}>
            {loading ? "—" : money(metrics.pipeline)}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Quotes
          </div>

          <div style={number}>
            {loading ? "—" : metrics.quotes}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Quote Value
          </div>

          <div style={number}>
            {loading ? "—" : money(metrics.quoteValue)}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Accepted Quote Value
          </div>

          <div style={number}>
            {loading
              ? "—"
              : money(metrics.acceptedValue)}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Confirmed Orders
          </div>

          <div style={number}>
            {loading ? "—" : metrics.orders}
          </div>
        </div>

        <div style={card}>
          <div style={label}>
            Order Value
          </div>

          <div style={number}>
            {loading
              ? "—"
              : money(metrics.orderValue)}
          </div>
        </div>
      </div>

      {/* Commercial Funnel */}
      <div
        style={{
          ...section,
          marginBottom: 20,
        }}
      >
        <h2 style={sectionTitle}>
          Commercial Funnel
        </h2>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {stageData.map((item) => (
            <div
              key={item.stage}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "170px 1fr 90px 140px",
                gap: 12,
                alignItems: "center",
              }}
            >
              <strong
                style={{
                  fontSize: 13,
                  color: "#334155",
                }}
              >
                {item.stage}
              </strong>

              <div
                style={{
                  height: 10,
                  background: "#edf0f3",
                  borderRadius: 99,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${
                      metrics.enquiries
                        ? Math.max(
                            8,
                            (item.count /
                              Math.max(
                                metrics.enquiries,
                                1
                              )) *
                              100
                          )
                        : 0
                    }%`,
                    background: "#172033",
                    borderRadius: 99,
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {item.count}
              </span>

              <span
                style={{
                  fontSize: 13,
                  color: "#64748b",
                  textAlign: "right",
                }}
              >
                {money(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column section */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(400px,1fr))",
          gap: 20,
        }}
      >
        {/* Quotes */}
        <div style={section}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              Latest Quotes
            </h2>

            <span style={smallText}>
              {quotes.length} total
            </span>
          </div>

          {quotes.length === 0 ? (
            <Empty />
          ) : (
            <div>
              {quotes.slice(0, 6).map((quote) => (
                <div
                  key={quote.id}
                  style={listRow}
                >
                  <div>
                    <strong>
                      {quote.quote_number}
                    </strong>

                    <div style={smallText}>
                      {quote.customer} ·{" "}
                      {quote.product}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong>
                      {money(
                        quote.total_value_usd
                      )}
                    </strong>

                    <div style={smallText}>
                      {quote.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Orders */}
        <div style={section}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>
              Latest Purchase Orders
            </h2>

            <span style={smallText}>
              {orders.length} total
            </span>
          </div>

          {orders.length === 0 ? (
            <Empty />
          ) : (
            <div>
              {orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  style={listRow}
                >
                  <div>
                    <strong>
                      {order.po_number}
                    </strong>

                    <div style={smallText}>
                      {order.customer} ·{" "}
                      {order.product}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong>
                      {money(order.value_usd)}
                    </strong>

                    <div style={smallText}>
                      {order.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lead table */}
      <div
        style={{
          ...section,
          marginTop: 20,
          overflowX: "auto",
        }}
      >
        <div style={sectionHeader}>
          <h2 style={sectionTitle}>
            Active Commercial Enquiries
          </h2>

          <span style={smallText}>
            {leads.length} enquiries
          </span>
        </div>

        <table
          style={{
            width: "100%",
            minWidth: 850,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              {[
                "Enquiry",
                "Customer",
                "Product",
                "Market",
                "Stage",
                "Value",
                "Owner",
              ].map((heading) => (
                <th
                  key={heading}
                  style={tableHead}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  No commercial enquiries.
                </td>
              </tr>
            ) : (
              leads.slice(0, 10).map((lead) => (
                <tr key={lead.id}>
                  <td style={tableCell}>
                    <strong>
                      {lead.enquiry_id}
                    </strong>
                  </td>

                  <td style={tableCell}>
                    {lead.customer}
                  </td>

                  <td style={tableCell}>
                    {lead.product}
                  </td>

                  <td style={tableCell}>
                    {lead.market}
                  </td>

                  <td style={tableCell}>
                    {lead.stage}
                  </td>

                  <td style={tableCell}>
                    {money(lead.value_usd)}
                  </td>

                  <td style={tableCell}>
                    {lead.owner || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 18,
};

const section: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 700,
  color: "#172033",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const label: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  marginBottom: 6,
};

const number: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 700,
  color: "#172033",
};

const smallText: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
};

const listRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "13px 0",
  borderBottom: "1px solid #f0f2f5",
  fontSize: 13,
};

const tableHead: React.CSSProperties = {
  padding: "12px 10px",
  textAlign: "left",
  fontSize: 11,
  color: "#64748b",
  borderBottom: "1px solid #e5e7eb",
};

const tableCell: React.CSSProperties = {
  padding: "12px 10px",
  fontSize: 13,
  borderBottom: "1px solid #f0f2f5",
};

function Empty() {
  return (
    <div
      style={{
        padding: 30,
        textAlign: "center",
        color: "#64748b",
      }}
    >
      No records available.
    </div>
  );
}