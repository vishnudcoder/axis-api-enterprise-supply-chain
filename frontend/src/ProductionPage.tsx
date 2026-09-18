import React, { useEffect, useMemo, useState } from "react";
import {api} from "./api";
import { useAuth } from "./auth";

type ProductionBatch = {
  id: number;
  batch_number: string;
  plan_id?: number | null;
  po_number?: string | null;
  customer?: string | null;
  product: string;
  reactor?: string | null;
  planned_quantity_kg: number;
  produced_quantity_kg: number;
  production_status: string;
  start_time?: string | null;
  completion_time?: string | null;
  operator?: string | null;
  remarks?: string | null;
};

const STATUS_OPTIONS = [
  "Not Started",
  "Running",
  "Paused",
  "Completed",
  "Rejected",
  "Cancelled",
];

const emptyForm = {
  batch_number: "",
  plan_id: "",
  po_number: "",
  customer: "",
  product: "",
  reactor: "",
  planned_quantity_kg: "",
  produced_quantity_kg: "",
  production_status: "Not Started",
  operator: "",
  remarks: "",
};

export default function ProductionPage() {
  const { user } = useAuth();

  const isAdmin =
    user?.role?.name === "Plant Head / Admin";

  const permissions = user?.role?.permissions?.find(
    (permission: any) =>
      String(permission.page || "").toLowerCase() ===
      "production"
  );

  const canCreate =
    isAdmin || Boolean(permissions?.can_create);

  const canEdit =
    isAdmin || Boolean(permissions?.can_edit);

  const canDelete =
    isAdmin || Boolean(permissions?.can_delete);

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] =
    useState<ProductionBatch | null>(null);

  const [viewing, setViewing] =
    useState<ProductionBatch | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [summary, setSummary] = useState({
    total_batches: 0,
    running: 0,
    completed: 0,
    not_started: 0,
  });

  const loadData = async () => {
    setLoading(true);

    try {
      const params: any = {
        page: 1,
        page_size: 100,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (status) {
        params.status = status;
      }

      const [batchResponse, summaryResponse] =
        await Promise.all([
          api.get("/api/production", { params }),
          api.get("/api/production/summary"),
        ]);

      setBatches(
        batchResponse.data?.items ||
          batchResponse.data ||
          []
      );

      setSummary({
        total_batches:
          summaryResponse.data?.total_batches || 0,
        running:
          summaryResponse.data?.running || 0,
        completed:
          summaryResponse.data?.completed || 0,
        not_started:
          summaryResponse.data?.not_started || 0,
      });
    } catch (error) {
      console.error(
        "Failed to load production data",
        error
      );
      alert("Failed to load production data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, status]);

  const openCreate = () => {
    setEditing(null);

    setForm({
      ...emptyForm,
      batch_number:
        "BATCH-" + Date.now(),
    });

    setShowForm(true);
  };

  const openEdit = (
    batch: ProductionBatch
  ) => {
    setEditing(batch);

    setForm({
      batch_number: batch.batch_number || "",
      plan_id:
        batch.plan_id?.toString() || "",
      po_number: batch.po_number || "",
      customer: batch.customer || "",
      product: batch.product || "",
      reactor: batch.reactor || "",
      planned_quantity_kg:
        batch.planned_quantity_kg?.toString() || "",
      produced_quantity_kg:
        batch.produced_quantity_kg?.toString() || "",
      production_status:
        batch.production_status ||
        "Not Started",
      operator: batch.operator || "",
      remarks: batch.remarks || "",
    });

    setShowForm(true);
  };

  const saveBatch = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!form.batch_number.trim()) {
      alert("Batch number is required.");
      return;
    }

    if (!form.product.trim()) {
      alert("Product is required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        batch_number:
          form.batch_number.trim(),

        plan_id:
          form.plan_id.trim()
            ? Number(form.plan_id)
            : null,

        po_number:
          form.po_number.trim() || null,

        customer:
          form.customer.trim() || null,

        product:
          form.product.trim(),

        reactor:
          form.reactor.trim() || null,

        planned_quantity_kg:
          Number(form.planned_quantity_kg || 0),

        produced_quantity_kg:
          Number(form.produced_quantity_kg || 0),

        production_status:
          form.production_status,

        operator:
          form.operator.trim() || null,

        remarks:
          form.remarks.trim() || null,
      };

      if (editing) {
        await api.put(
          `/api/production/${editing.id}`,
          payload
        );

        alert(
          "Production batch updated successfully."
        );
      } else {
        await api.post(
          "/api/production",
          payload
        );

        alert(
          "Production batch created successfully."
        );
      }

      setShowForm(false);
      setEditing(null);
      setForm(emptyForm);

      await loadData();
    } catch (error: any) {
      console.error(
        "Failed to save production batch",
        error
      );

      alert(
        error?.response?.data?.detail ||
          "Failed to save production batch."
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (
    batch: ProductionBatch,
    newStatus: string
  ) => {
    if (!canEdit) {
      return;
    }

    try {
      await api.patch(
        `/api/production/${batch.id}/status`,
        null,
        {
          params: {
            status: newStatus,
          },
        }
      );

      await loadData();
    } catch (error: any) {
      console.error(
        "Failed to change production status",
        error
      );

      alert(
        error?.response?.data?.detail ||
          "Failed to change production status."
      );
    }
  };

  const deleteBatch = async (
    batch: ProductionBatch
  ) => {
    if (!canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Delete production batch ${batch.batch_number}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/api/production/${batch.id}`
      );

      alert(
        "Production batch deleted successfully."
      );

      await loadData();
    } catch (error: any) {
      console.error(
        "Failed to delete production batch",
        error
      );

      alert(
        error?.response?.data?.detail ||
          "Failed to delete production batch."
      );
    }
  };

  const completionRate = useMemo(() => {
    const planned = batches.reduce(
      (sum, batch) =>
        sum +
        Number(
          batch.planned_quantity_kg || 0
        ),
      0
    );

    const produced = batches.reduce(
      (sum, batch) =>
        sum +
        Number(
          batch.produced_quantity_kg || 0
        ),
      0
    );

    if (!planned) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (produced / planned) * 100
      )
    );
  }, [batches]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>Production</h1>
          <h2>Production batch execution</h2>
        </div>

        {canCreate && (
          <button
            className="primary-button"
            onClick={openCreate}
          >
            + Create Batch
          </button>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Total Batches</span>
          <strong>
            {summary.total_batches}
          </strong>
        </div>

        <div className="kpi-card">
          <span>Running</span>
          <strong>
            {summary.running}
          </strong>
        </div>

        <div className="kpi-card">
          <span>Completed</span>
          <strong>
            {summary.completed}
          </strong>
        </div>

        <div className="kpi-card">
          <span>Not Started</span>
          <strong>
            {summary.not_started}
          </strong>
        </div>

        <div className="kpi-card">
          <span>Production Progress</span>
          <strong>
            {completionRate}%
          </strong>
        </div>
      </div>

      <div className="content-card">
        <div className="toolbar">
          <input
            className="search-input"
            placeholder="Search batch, PO, customer, product or reactor..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <select
            className="filter-select"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
          >
            <option value="">
              All Statuses
            </option>

            {STATUS_OPTIONS.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              )
            )}
          </select>

          <button
            className="secondary-button"
            onClick={loadData}
          >
            Refresh
          </button>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>PO</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Reactor</th>
                <th>Planned kg</th>
                <th>Produced kg</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                    }}
                  >
                    No production batches found.
                  </td>
                </tr>
              ) : (
                batches.map(
                  (batch) => (
                    <tr
                      key={batch.id}
                    >
                      <td>
                        <strong>
                          {
                            batch.batch_number
                          }
                        </strong>
                      </td>

                      <td>
                        {batch.po_number ||
                          "-"}
                      </td>

                      <td>
                        {batch.customer ||
                          "-"}
                      </td>

                      <td>
                        {batch.product}
                      </td>

                      <td>
                        {batch.reactor ||
                          "-"}
                      </td>

                      <td>
                        {Number(
                          batch.planned_quantity_kg ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {Number(
                          batch.produced_quantity_kg ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {canEdit ? (
                          <select
                            value={
                              batch.production_status
                            }
                            onChange={(e) =>
                              changeStatus(
                                batch,
                                e.target.value
                              )
                            }
                          >
                            {STATUS_OPTIONS.map(
                              (item) => (
                                <option
                                  key={
                                    item
                                  }
                                  value={
                                    item
                                  }
                                >
                                  {item}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          batch.production_status
                        )}
                      </td>

                      <td>
                        <div className="action-row">
                          <button
                            className="small-button"
                            onClick={() =>
                              setViewing(
                                batch
                              )
                            }
                          >
                            View
                          </button>

                          {canEdit && (
                            <button
                              className="small-button"
                              onClick={() =>
                                openEdit(
                                  batch
                                )
                              }
                            >
                              Edit
                            </button>
                          )}

                          {canDelete && (
                            <button
                              className="small-button danger"
                              onClick={() =>
                                deleteBatch(
                                  batch
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>
                {editing
                  ? "Edit Production Batch"
                  : "Create Production Batch"}
              </h2>

              <button
                className="modal-close"
                onClick={() =>
                  setShowForm(false)
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveBatch}
            >
              <div className="form-grid">
                <label>
                  Batch Number *
                  <input
                    value={
                      form.batch_number
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        batch_number:
                          e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  PPIC Plan ID
                  <input
                    type="number"
                    value={form.plan_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        plan_id:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  PO Number
                  <input
                    value={form.po_number}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        po_number:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Customer
                  <input
                    value={form.customer}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customer:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Product *
                  <input
                    value={form.product}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        product:
                          e.target.value,
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Reactor
                  <input
                    value={form.reactor}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        reactor:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Planned Quantity (kg)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.planned_quantity_kg
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        planned_quantity_kg:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Produced Quantity (kg)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.produced_quantity_kg
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        produced_quantity_kg:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Production Status
                  <select
                    value={
                      form.production_status
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        production_status:
                          e.target.value,
                      })
                    }
                  >
                    {STATUS_OPTIONS.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Operator
                  <input
                    value={form.operator}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        operator:
                          e.target.value,
                      })
                    }
                  />
                </label>

                <label
                  style={{
                    gridColumn:
                      "1 / -1",
                  }}
                >
                  Remarks
                  <textarea
                    rows={4}
                    value={form.remarks}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        remarks:
                          e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowForm(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editing
                    ? "Update Batch"
                    : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>
                {viewing.batch_number}
              </h2>

              <button
                className="modal-close"
                onClick={() =>
                  setViewing(null)
                }
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>PO Number</span>
                <strong>
                  {viewing.po_number ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>Customer</span>
                <strong>
                  {viewing.customer ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>Product</span>
                <strong>
                  {viewing.product}
                </strong>
              </div>

              <div>
                <span>Reactor</span>
                <strong>
                  {viewing.reactor ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>Planned Quantity</span>
                <strong>
                  {
                    viewing.planned_quantity_kg
                  }{" "}
                  kg
                </strong>
              </div>

              <div>
                <span>Produced Quantity</span>
                <strong>
                  {
                    viewing.produced_quantity_kg
                  }{" "}
                  kg
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  {
                    viewing.production_status
                  }
                </strong>
              </div>

              <div>
                <span>Operator</span>
                <strong>
                  {viewing.operator ||
                    "-"}
                </strong>
              </div>
            </div>

            {viewing.remarks && (
              <div
                style={{
                  marginTop: 20,
                }}
              >
                <strong>
                  Remarks
                </strong>

                <p>
                  {viewing.remarks}
                </p>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setViewing(null)
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