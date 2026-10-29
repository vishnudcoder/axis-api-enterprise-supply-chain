import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

type Row = Record<string, unknown>;

type CustomerRequest = Row & {
  sample_id: string;
  sample_number: string;
  sample_status: string;
  product_id: string;
  product_name: string;
  customer_name?: string | null;
  lead_number?: string | null;
  requested_at: string;
  dispatched_at?: string | null;
  coa_required: boolean;
};

type QualitySample = Row & {
  quality_sample_id: string;
  sample_number: string;
  product_id: string;
  product_name: string;
  customer_sample_id?: string | null;
  customer_sample_number?: string | null;
  sample_type: string;
  collected_at: string;
  status: string;
};

type TestAttempt = Row & {
  test_attempt_id: string;
  attempt_no: number;
  test_code: string;
  started_at?: string | null;
  completed_at?: string | null;
  result_status: string;
  result_value?: number | null;
  result_text?: string | null;
  result_data?: unknown;
  result_uom_id?: string | null;
};

type TestRequest = Row & {
  test_request_id: string;
  quality_sample_id: string;
  sample_number: string;
  customer_sample_number?: string | null;
  product_name: string;
  test_panel_code: string;
  requested_at: string;
  status: string;
  attempts?: TestAttempt[];
};

type ListResult<T> = {
  items: T[];
  total: number;
};

type CustomerLookups = {
  customers: Array<Row & { customer_id: string; customer_name: string; customer_code: string }>;
  leads: Array<Row & { lead_id: string; lead_number: string; opportunity_title?: string }>;
  products: Array<Row & { product_id: string; product_code: string; product_name: string }>;
};

type QualityLookups = {
  products: Array<Row & { product_id: string; product_code: string; product_name: string }>;
  batches: Array<Row & { batch_id: string; batch_number: string; product_id: string }>;
  material_lots: Array<Row & {
    material_lot_id: string;
    lot_number: string;
    internal_lot_number?: string | null;
    product_id: string;
  }>;
  customer_samples: Array<Row & {
    sample_id: string;
    sample_number: string;
    sample_status: string;
    product_id: string;
    product_code: string;
    product_name: string;
  }>;
  sample_types: Array<Row & {
    sample_type_code: string;
    sample_type_name: string;
  }>;
};

type TestLookups = {
  quality_samples: Array<Row & {
    quality_sample_id: string;
    sample_number: string;
    product_id: string;
    product_code: string;
    product_name: string;
    customer_sample_number?: string | null;
  }>;
  specification_revisions: Array<Row & {
    specification_revision_id: string;
    product_id: string;
    specification_code: string;
    revision_no: string | number;
  }>;
  uoms: Array<Row & { uom_id: string; uom_code: string; uom_name: string }>;
};

type Tab = "Customer Requests" | "Quality Samples" | "Tests Pending";

const tabs: Tab[] = ["Customer Requests", "Quality Samples", "Tests Pending"];
const pageSize = 25;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toISO(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function errorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg ?? fallback).join(", ");
  }
  return fallback;
}

function RecordTable({
  rows,
  rowKey,
  columns,
  onOpen,
}: {
  rows: Row[];
  rowKey: string;
  columns: Array<{ key: string; label: string }>;
  onOpen: (row: Row) => void;
}) {
  return (
    <div className="responsive-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length + 1}>No records found.</td></tr>
          ) : rows.map((row) => (
            <tr key={String(row[rowKey])}>
              {columns.map((column) => (
                <td key={column.key}>{formatValue(row[column.key])}</td>
              ))}
              <td>
                <button className="secondary-button" onClick={() => onOpen(row)}>
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SampleManagementPage() {
  const { can } = useAuth();
  const canViewCustomers = can("Customers");
  const canViewQuality = can("Samples");
  const canCreateRequests = can("Customers", "create");
  const canUpdateRequests = can("Customers", "edit");
  const canCreateQuality = can("Samples", "create");
  const canUpdateQuality = can("Samples", "edit");
  const visibleTabs = tabs.filter((item) =>
    item === "Customer Requests" ? canViewCustomers : canViewQuality,
  );
  const [tab, setTab] = useState<Tab>("Customer Requests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const [qualitySamples, setQualitySamples] = useState<QualitySample[]>([]);
  const [testRequests, setTestRequests] = useState<TestRequest[]>([]);

  const [customerLookups, setCustomerLookups] = useState<CustomerLookups | null>(null);
  const [qualityLookups, setQualityLookups] = useState<QualityLookups | null>(null);
  const [testLookups, setTestLookups] = useState<TestLookups | null>(null);

  const [selectedCustomerRequest, setSelectedCustomerRequest] = useState<CustomerRequest | null>(null);
  const [selectedQualitySample, setSelectedQualitySample] = useState<QualitySample | null>(null);
  const [selectedTestRequest, setSelectedTestRequest] = useState<TestRequest | null>(null);

  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [qualityFormOpen, setQualityFormOpen] = useState(false);
  const [testFormOpen, setTestFormOpen] = useState(false);
  const [attemptFormOpen, setAttemptFormOpen] = useState(false);
  const [resultAttempt, setResultAttempt] = useState<TestAttempt | null>(null);

  const [requestForm, setRequestForm] = useState({
    sample_number: "",
    customer_id: "",
    lead_id: "",
    product_id: "",
    coa_required: false,
  });
  const [qualityForm, setQualityForm] = useState({
    request_id: "",
    customer_sample_id: "",
    product_id: "",
    sample_type: "",
    collected_at: "",
    origin_type: "batch" as "batch" | "material_lot",
    batch_id: "",
    material_lot_id: "",
  });
  const [testForm, setTestForm] = useState({
    quality_sample_id: "",
    specification_revision_id: "",
    test_panel_code: "",
  });
  const [attemptForm, setAttemptForm] = useState({ attempt_no: "", test_code: "" });
  const [resultForm, setResultForm] = useState({
    result_value: "",
    result_text: "",
    result_data: "",
    result_uom_id: "",
  });

  const loadRows = useCallback(async () => {
    if (
      (tab === "Customer Requests" && !canViewCustomers) ||
      (tab !== "Customer Requests" && !canViewQuality)
    ) {
      setLoading(false);
      setError("You do not have permission to view this section.");
      return;
    }
    setLoading(true);
    setError("");
    const baseParams = {
      limit: pageSize,
      offset,
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    };
    const endpoint =
      tab === "Customer Requests"
        ? "/api/sample-management/customer-requests"
        : tab === "Quality Samples"
          ? "/api/sample-management/quality-samples"
          : "/api/sample-management/test-requests";
    const statusEndpoint =
      tab === "Customer Requests"
        ? "/api/sample-management/customer-requests/statuses"
        : tab === "Quality Samples"
          ? "/api/sample-management/quality-samples/statuses"
          : "/api/sample-management/test-requests/statuses";
    try {
      const [listResponse, statusResponse] = await Promise.all([
        api.get<ListResult<Row>>(endpoint, { params: baseParams }),
        api.get<Record<string, unknown>>(statusEndpoint),
      ]);
      const data = listResponse.data;
      if (tab === "Customer Requests") {
        setCustomerRequests(data.items as CustomerRequest[]);
        setStatusOptions((statusResponse.data.items as string[]) ?? []);
      } else if (tab === "Quality Samples") {
        setQualitySamples(data.items as QualitySample[]);
        setStatusOptions((statusResponse.data.items as string[]) ?? []);
      } else {
        setTestRequests(data.items as TestRequest[]);
        setStatusOptions((statusResponse.data.request_statuses as string[]) ?? []);
      }
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(errorMessage(err, "Unable to load sample records."));
    } finally {
      setLoading(false);
    }
  }, [canViewCustomers, canViewQuality, offset, search, statusFilter, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRows(), 250);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  useEffect(() => {
    if (!visibleTabs.includes(tab) && visibleTabs.length > 0) {
      setTab(visibleTabs[0]);
      setOffset(0);
      setStatusFilter("");
    }
  }, [tab, canViewCustomers, canViewQuality]);

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab);
    setSearch("");
    setStatusFilter("");
    setOffset(0);
    setError("");
    setSelectedCustomerRequest(null);
    setSelectedQualitySample(null);
    setSelectedTestRequest(null);
  };

  const openRequestForm = async (request?: CustomerRequest) => {
    setError("");
    if (!request) setSelectedCustomerRequest(null);
    try {
      const response = await api.get<CustomerLookups>(
        "/api/sample-management/customer-requests/lookups",
      );
      setCustomerLookups(response.data);
      setRequestForm(request
        ? {
            sample_number: request.sample_number,
            customer_id: String(request.customer_id ?? ""),
            lead_id: String(request.lead_id ?? ""),
            product_id: String(request.product_id),
            coa_required: request.coa_required,
          }
        : {
            sample_number: "",
            customer_id: "",
            lead_id: "",
            product_id: "",
            coa_required: false,
          });
      setRequestFormOpen(true);
    } catch (err) {
      setError(errorMessage(err, "Unable to load customer request options."));
    }
  };

  const openQualityForm = async (customerSample?: CustomerRequest) => {
    setError("");
    if (tab !== "Quality Samples") changeTab("Quality Samples");
    try {
      const response = await api.get<QualityLookups>(
        "/api/sample-management/quality-samples/lookups",
      );
      setQualityLookups(response.data);
      setQualityForm({
        request_id: crypto.randomUUID(),
        customer_sample_id: customerSample?.sample_id ?? "",
        product_id: customerSample?.product_id ?? "",
        sample_type: "",
        collected_at: "",
        origin_type: "batch",
        batch_id: "",
        material_lot_id: "",
      });
      setQualityFormOpen(true);
    } catch (err) {
      setError(errorMessage(err, "Unable to load Quality sample options."));
    }
  };

  const openTestForm = async (sample?: QualitySample) => {
    setError("");
    if (tab !== "Tests Pending") changeTab("Tests Pending");
    try {
      const response = await api.get<TestLookups>(
        "/api/sample-management/test-requests/lookups",
      );
      setTestLookups(response.data);
      setTestForm({
        quality_sample_id: sample?.quality_sample_id ?? "",
        specification_revision_id: "",
        test_panel_code: "",
      });
      setTestFormOpen(true);
    } catch (err) {
      setError(errorMessage(err, "Unable to load test request options."));
    }
  };

  const openCustomerRequest = async (row: Row) => {
    try {
      const response = await api.get<CustomerRequest>(
        `/api/sample-management/customer-requests/${row.sample_id}`,
      );
      setSelectedCustomerRequest(response.data);
      setSelectedQualitySample(null);
      setSelectedTestRequest(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load customer request details."));
    }
  };

  const openQualitySample = async (row: Row) => {
    try {
      const response = await api.get<QualitySample>(
        `/api/sample-management/quality-samples/${row.quality_sample_id}`,
      );
      setSelectedQualitySample(response.data);
      setSelectedCustomerRequest(null);
      setSelectedTestRequest(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load Quality sample details."));
    }
  };

  const openTestRequest = async (row: Row) => {
    try {
      const [requestResponse, lookupResponse] = await Promise.all([
        api.get<TestRequest>(
          `/api/sample-management/test-requests/${row.test_request_id}`,
        ),
        api.get<TestLookups>("/api/sample-management/test-requests/lookups"),
      ]);
      setSelectedTestRequest(requestResponse.data);
      setTestLookups(lookupResponse.data);
      setSelectedCustomerRequest(null);
      setSelectedQualitySample(null);
    } catch (err) {
      setError(errorMessage(err, "Unable to load test history."));
    }
  };

  const saveCustomerRequest = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/api/sample-management/customer-requests", {
        sample_number: requestForm.sample_number.trim(),
        product_id: requestForm.product_id,
        customer_id: requestForm.customer_id || null,
        lead_id: requestForm.lead_id || null,
        coa_required: requestForm.coa_required,
      });
      setRequestFormOpen(false);
      setOffset(0);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to save customer sample request."));
    } finally {
      setSaving(false);
    }
  };

  const updateCustomerRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCustomerRequest) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(
        `/api/sample-management/customer-requests/${selectedCustomerRequest.sample_id}`,
        {
          sample_number: requestForm.sample_number.trim(),
          product_id: requestForm.product_id,
          customer_id: requestForm.customer_id || null,
          lead_id: requestForm.lead_id || null,
          coa_required: requestForm.coa_required,
        },
      );
      setRequestFormOpen(false);
      await openCustomerRequest(selectedCustomerRequest);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to update customer sample request."));
    } finally {
      setSaving(false);
    }
  };

  const recordDispatch = async () => {
    if (!selectedCustomerRequest) return;
    setSaving(true);
    setError("");
    try {
      const response = await api.post<CustomerRequest>(
        `/api/sample-management/customer-requests/${selectedCustomerRequest.sample_id}/dispatch`,
      );
      setSelectedCustomerRequest(response.data);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to record dispatch."));
    } finally {
      setSaving(false);
    }
  };

  const saveQualitySample = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/api/sample-management/quality-samples", {
        request_id: qualityForm.request_id,
        p_customer_sample_id: qualityForm.customer_sample_id || null,
        product_id: qualityForm.product_id,
        sample_type: qualityForm.sample_type.trim(),
        collected_at: toISO(qualityForm.collected_at),
        batch_id: qualityForm.origin_type === "batch" ? qualityForm.batch_id : null,
        material_lot_id: qualityForm.origin_type === "material_lot"
          ? qualityForm.material_lot_id
          : null,
      });
      setQualityFormOpen(false);
      setOffset(0);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to register Quality sample."));
    } finally {
      setSaving(false);
    }
  };

  const saveTestRequest = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/api/sample-management/test-requests", {
        quality_sample_id: testForm.quality_sample_id,
        specification_revision_id: testForm.specification_revision_id,
        test_panel_code: testForm.test_panel_code.trim(),
      });
      setTestFormOpen(false);
      setOffset(0);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to request tests."));
    } finally {
      setSaving(false);
    }
  };

  const startAttempt = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTestRequest) return;
    setSaving(true);
    setError("");
    try {
      await api.post(
        `/api/sample-management/test-requests/${selectedTestRequest.test_request_id}/attempts`,
        {
          attempt_no: Number(attemptForm.attempt_no),
          test_code: attemptForm.test_code.trim(),
        },
      );
      setAttemptFormOpen(false);
      await openTestRequest(selectedTestRequest);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to start test attempt."));
    } finally {
      setSaving(false);
    }
  };

  const saveAttemptResults = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTestRequest || !resultAttempt) return;
    setSaving(true);
    setError("");
    try {
      let resultData: unknown = undefined;
      if (resultForm.result_data.trim()) {
        try {
          resultData = JSON.parse(resultForm.result_data);
        } catch {
          throw new Error("Result data must be valid JSON.");
        }
      }
      await api.patch(
        `/api/sample-management/test-requests/${selectedTestRequest.test_request_id}/attempts/${resultAttempt.test_attempt_id}`,
        {
          result_value: resultForm.result_value === "" ? null : Number(resultForm.result_value),
          result_text: resultForm.result_text || null,
          result_data: resultData ?? null,
          result_uom_id: resultForm.result_uom_id || null,
        },
      );
      setResultAttempt(null);
      await openTestRequest(selectedTestRequest);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error
        ? err.message
        : errorMessage(err, "Unable to save test results."));
    } finally {
      setSaving(false);
    }
  };

  const completeAttempt = async (attempt: TestAttempt) => {
    if (!selectedTestRequest) return;
    setSaving(true);
    setError("");
    try {
      await api.post(
        `/api/sample-management/test-requests/${selectedTestRequest.test_request_id}/attempts/${attempt.test_attempt_id}/complete`,
      );
      await openTestRequest(selectedTestRequest);
      await loadRows();
    } catch (err) {
      setError(errorMessage(err, "Unable to complete test attempt."));
    } finally {
      setSaving(false);
    }
  };

  const commonColumns =
    tab === "Customer Requests"
      ? [
          { key: "sample_number", label: "Sample Number" },
          { key: "customer_name", label: "Customer" },
          { key: "lead_number", label: "Lead" },
          { key: "product_name", label: "Product" },
          { key: "sample_status", label: "Status" },
          { key: "requested_at", label: "Requested" },
          { key: "dispatched_at", label: "Dispatched" },
        ]
      : tab === "Quality Samples"
        ? [
            { key: "sample_number", label: "Sample Number" },
            { key: "customer_sample_number", label: "Customer Request" },
            { key: "product_name", label: "Product" },
            { key: "sample_type", label: "Sample Type" },
            { key: "collected_at", label: "Collected" },
            { key: "batch_number", label: "Batch" },
            { key: "lot_number", label: "Material Lot" },
            { key: "status", label: "Status" },
          ]
        : [
            { key: "test_request_id", label: "Test Request" },
            { key: "sample_number", label: "Quality Sample" },
            { key: "customer_sample_number", label: "Customer Request" },
            { key: "product_name", label: "Product" },
            { key: "test_panel_code", label: "Test Panel" },
            { key: "requested_at", label: "Requested" },
            { key: "status", label: "Request Status" },
          ];

  const rows: Row[] =
    tab === "Customer Requests"
      ? customerRequests
      : tab === "Quality Samples"
        ? qualitySamples
        : testRequests;
  const keyField =
    tab === "Customer Requests"
      ? "sample_id"
      : tab === "Quality Samples"
        ? "quality_sample_id"
        : "test_request_id";
  const openRow =
    tab === "Customer Requests"
      ? openCustomerRequest
      : tab === "Quality Samples"
        ? openQualitySample
        : openTestRequest;

  const selectedSample = testLookups?.quality_samples.find(
    (sample) => sample.quality_sample_id === testForm.quality_sample_id,
  );
  const compatibleRevisions = testLookups?.specification_revisions.filter(
    (revision) => !selectedSample || revision.product_id === selectedSample.product_id,
  ) ?? [];
  const availableBatches = qualityLookups?.batches.filter(
    (batch) => !qualityForm.product_id || batch.product_id === qualityForm.product_id,
  ) ?? [];
  const availableMaterialLots = qualityLookups?.material_lots.filter(
    (lot) => !qualityForm.product_id || lot.product_id === qualityForm.product_id,
  ) ?? [];

  return (
    <main className="page-content sample-management">
      <div className="page-header">
        <div>
          <h1>Sample Management</h1>
          <p>Customer requests, Quality sample registration, and laboratory tests.</p>
        </div>
        {tab === "Customer Requests" && canCreateRequests ? (
          <button className="primary-button" onClick={() => void openRequestForm()}>
            + New Request
          </button>
        ) : tab === "Quality Samples" && canCreateQuality ? (
          <button className="primary-button" onClick={() => void openQualityForm()}>
            + Register Sample
          </button>
        ) : tab === "Tests Pending" && canCreateQuality ? (
          <button className="primary-button" onClick={() => void openTestForm()}>
            + Request Tests
          </button>
        ) : null}
      </div>

      <div className="customer-tabs" role="tablist" aria-label="Sample management tabs">
        {visibleTabs.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={`customer-tab${tab === item ? " active" : ""}`}
            onClick={() => changeTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Quality Samples" && (
        <p role="note">
          Quality samples can link to a commercial customer request. The database assigns sample numbers and requires one approved sample type and exactly one batch or material-lot origin.
        </p>
      )}
      {tab === "Customer Requests" && (
        <p role="note">
          Quantity, UOM, purpose, priority, recipient, carrier, tracking, and customer-receipt fields are not present in the current customer sample table.
        </p>
      )}
      {tab === "Tests Pending" && (
        <p role="note">
          Review, retest-reason, and invalidation fields are not present in the current test-attempt table. This screen records attempts and results but does not change workflow statuses because permitted transitions are unconfirmed; test-specific unit compatibility is also unavailable.
        </p>
      )}

      <section className="data-panel">
        <div className="filter-row">
          <input
            className="form-input"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search sample, product, request..."
            aria-label="Search sample records"
          />
          <select
            className="form-input"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setOffset(0);
            }}
            aria-label="Filter by saved status"
          >
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
          <span>{total} matching records</span>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        {loading ? (
          <p>Loading sample records...</p>
        ) : (
          <RecordTable
            rows={rows}
            rowKey={keyField}
            columns={commonColumns}
            onOpen={(row) => void openRow(row)}
          />
        )}

        <div className="customer-pagination">
          <span>
            {total === 0 ? "0 records" : `${offset + 1}-${Math.min(offset + pageSize, total)} of ${total}`}
          </span>
          <div className="table-actions">
            <button
              className="secondary-button"
              disabled={loading || offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - pageSize))}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={loading || offset + pageSize >= total}
              onClick={() => setOffset((current) => current + pageSize)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedCustomerRequest && (
        <section className="data-panel">
          <div className="panel-header">
            <div>
              <h2>{selectedCustomerRequest.sample_number}</h2>
              <p>{selectedCustomerRequest.product_name} · {selectedCustomerRequest.sample_status}</p>
            </div>
            {canUpdateRequests && (
              <button
                className="secondary-button"
                onClick={() => void openRequestForm(selectedCustomerRequest)}
              >
                Edit Request
              </button>
            )}
          </div>
          <p>Customer: {formatValue(selectedCustomerRequest.customer_name)}</p>
          <p>Lead: {formatValue(selectedCustomerRequest.lead_number)}</p>
          <p>COA required: {formatValue(selectedCustomerRequest.coa_required)}</p>
          <p>Requested: {formatValue(selectedCustomerRequest.requested_at)}</p>
          <p>Dispatched: {formatValue(selectedCustomerRequest.dispatched_at)}</p>
          {canCreateQuality && (
            <button
              className="primary-button"
              onClick={() => void openQualityForm(selectedCustomerRequest)}
            >
              Register Quality Sample
            </button>
          )}
          {!selectedCustomerRequest.dispatched_at && canUpdateRequests && (
            <button className="primary-button" disabled={saving} onClick={() => void recordDispatch()}>
              Record Dispatch
            </button>
          )}
        </section>
      )}

      {selectedQualitySample && (
        <section className="data-panel">
          <div className="panel-header">
            <div>
              <h2>{selectedQualitySample.sample_number}</h2>
              <p>{selectedQualitySample.product_name} · {selectedQualitySample.status}</p>
            </div>
            {canCreateQuality && (
              <button className="primary-button" onClick={() => void openTestForm(selectedQualitySample)}>
                Request Tests
              </button>
            )}
          </div>
          <p>Type: {selectedQualitySample.sample_type}</p>
          <p>Customer request: {formatValue(selectedQualitySample.customer_sample_number)}</p>
          <p>Collected: {formatValue(selectedQualitySample.collected_at)}</p>
          <p>Batch: {formatValue(selectedQualitySample.batch_number)}</p>
          <p>Material lot: {formatValue(selectedQualitySample.lot_number)}</p>
        </section>
      )}

      {selectedTestRequest && (
        <section className="data-panel">
          <div className="panel-header">
            <div>
              <h2>Test Request</h2>
              <p>{selectedTestRequest.sample_number} · {selectedTestRequest.test_panel_code} · {selectedTestRequest.status}</p>
              <p>Customer request: {formatValue(selectedTestRequest.customer_sample_number)}</p>
            </div>
            {canUpdateQuality && (
              <button
                className="primary-button"
                onClick={() => {
                  setAttemptForm({ attempt_no: "", test_code: "" });
                  setAttemptFormOpen(true);
                }}
              >
                Start Test Attempt
              </button>
            )}
          </div>
          <p>Specification revision: {formatValue(selectedTestRequest.revision_no)}</p>
          <h3>Attempt history</h3>
          {(selectedTestRequest.attempts ?? []).length === 0 ? (
            <p>No attempts recorded.</p>
          ) : (selectedTestRequest.attempts ?? []).map((attempt) => (
            <div key={attempt.test_attempt_id} className="customer-detail-card">
              <strong>Attempt {attempt.attempt_no}: {attempt.test_code}</strong>
              <p>Result status: {attempt.result_status}</p>
              <p>Started: {formatValue(attempt.started_at)}</p>
              <p>Completed: {formatValue(attempt.completed_at)}</p>
              <p>Numeric result: {formatValue(attempt.result_value)}</p>
              <p>Text result: {formatValue(attempt.result_text)}</p>
              <p>Structured result: {formatValue(attempt.result_data)}</p>
              {!attempt.completed_at && canUpdateQuality && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setResultAttempt(attempt);
                      setResultForm({
                        result_value: attempt.result_value == null ? "" : String(attempt.result_value),
                        result_text: attempt.result_text ?? "",
                        result_data: attempt.result_data == null
                          ? ""
                          : JSON.stringify(attempt.result_data, null, 2),
                        result_uom_id: String(attempt.result_uom_id ?? ""),
                      });
                    }}
                  >
                    Enter Results
                  </button>
                  <button
                    className="secondary-button"
                    disabled={saving}
                    onClick={() => void completeAttempt(attempt)}
                  >
                    Complete Attempt
                  </button>
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {(requestFormOpen || qualityFormOpen || testFormOpen || attemptFormOpen || resultAttempt) && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            padding: 20,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <section
            className="data-panel modal-card"
            role="dialog"
            aria-modal="true"
            style={{
              width: "min(620px, 100%)",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            {error && <div className="form-error" role="alert">{error}</div>}
            {requestFormOpen && (
              <form onSubmit={selectedCustomerRequest ? updateCustomerRequest : saveCustomerRequest}>
                <h2>{selectedCustomerRequest ? "Edit Customer Request" : "New Customer Request"}</h2>
                <label>Sample number *<input required maxLength={80} value={requestForm.sample_number} onChange={(event) => setRequestForm({ ...requestForm, sample_number: event.target.value })} /></label>
                <label>Customer
                  <select value={requestForm.customer_id} onChange={(event) => setRequestForm({ ...requestForm, customer_id: event.target.value })}>
                    <option value="">None</option>
                    {(customerLookups?.customers ?? []).map((item) => <option key={item.customer_id} value={item.customer_id}>{item.customer_code} — {item.customer_name}</option>)}
                  </select>
                </label>
                <label>Lead / prospect
                  <select value={requestForm.lead_id} onChange={(event) => setRequestForm({ ...requestForm, lead_id: event.target.value })}>
                    <option value="">None</option>
                    {(customerLookups?.leads ?? []).map((item) => <option key={item.lead_id} value={item.lead_id}>{item.lead_number} — {String(item.opportunity_title ?? item.lead_status ?? "")}</option>)}
                  </select>
                </label>
                <label>Product *
                  <select required value={requestForm.product_id} onChange={(event) => setRequestForm({ ...requestForm, product_id: event.target.value })}>
                    <option value="">Select product</option>
                    {(customerLookups?.products ?? []).map((item) => <option key={item.product_id} value={item.product_id}>{item.product_code} — {item.product_name}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" style={{ width: 18 }} checked={requestForm.coa_required} onChange={(event) => setRequestForm({ ...requestForm, coa_required: event.target.checked })} /> COA required</label>
                <p>Sample status and request time are assigned by the database.</p>
                <FormActions onCancel={() => setRequestFormOpen(false)} saving={saving} />
              </form>
            )}

            {qualityFormOpen && (
              <form onSubmit={saveQualitySample}>
                <h2>Register Quality Sample</h2>
                <label>Commercial customer request
                  <select
                    value={qualityForm.customer_sample_id}
                    onChange={(event) => {
                      const customerSampleId = event.target.value;
                      const selectedRequest = qualityLookups?.customer_samples.find(
                        (item) => item.sample_id === customerSampleId,
                      );
                      setQualityForm({
                        ...qualityForm,
                        customer_sample_id: customerSampleId,
                        product_id: selectedRequest?.product_id ?? qualityForm.product_id,
                        batch_id: "",
                        material_lot_id: "",
                      });
                    }}
                  >
                    <option value="">None</option>
                    {(qualityLookups?.customer_samples ?? []).map((item) => (
                      <option key={item.sample_id} value={item.sample_id}>
                        {item.sample_number} — {item.product_code} {item.product_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>Product *
                  <select
                    required
                    disabled={Boolean(qualityForm.customer_sample_id)}
                    value={qualityForm.product_id}
                    onChange={(event) => setQualityForm({
                      ...qualityForm,
                      product_id: event.target.value,
                      batch_id: "",
                      material_lot_id: "",
                    })}
                  >
                    <option value="">Select product</option>
                    {(qualityLookups?.products ?? []).map((item) => <option key={item.product_id} value={item.product_id}>{item.product_code} — {item.product_name}</option>)}
                  </select>
                </label>
                <label>Approved sample type *
                  <select
                    required
                    value={qualityForm.sample_type}
                    onChange={(event) => setQualityForm({ ...qualityForm, sample_type: event.target.value })}
                  >
                    <option value="">Select approved sample type</option>
                    {(qualityLookups?.sample_types ?? []).map((item) => (
                      <option key={item.sample_type_code} value={item.sample_type_code}>
                        {item.sample_type_name} ({item.sample_type_code})
                      </option>
                    ))}
                  </select>
                </label>
                {qualityLookups?.sample_types.length === 0 && (
                  <p role="note">No active approved sample types are available. Ask Quality to approve a sample type before registering a sample.</p>
                )}
                <label>Collected at *<input required type="datetime-local" value={qualityForm.collected_at} onChange={(event) => setQualityForm({ ...qualityForm, collected_at: event.target.value })} /></label>
                <label>Sample origin *
                  <select
                    required
                    value={qualityForm.origin_type}
                    onChange={(event) => setQualityForm({
                      ...qualityForm,
                      origin_type: event.target.value as "batch" | "material_lot",
                      batch_id: "",
                      material_lot_id: "",
                    })}
                  >
                    <option value="batch">Manufacturing batch</option>
                    <option value="material_lot">Material lot</option>
                  </select>
                </label>
                {qualityForm.origin_type === "batch" ? (
                  <label>Manufacturing batch *
                    <select
                      required
                      value={qualityForm.batch_id}
                      onChange={(event) => setQualityForm({ ...qualityForm, batch_id: event.target.value })}
                    >
                      <option value="">Select batch</option>
                      {availableBatches.map((item) => <option key={item.batch_id} value={item.batch_id}>{item.batch_number}</option>)}
                    </select>
                  </label>
                ) : (
                  <label>Material lot *
                    <select
                      required
                      value={qualityForm.material_lot_id}
                      onChange={(event) => setQualityForm({ ...qualityForm, material_lot_id: event.target.value })}
                    >
                      <option value="">Select material lot</option>
                      {availableMaterialLots.map((item) => <option key={item.material_lot_id} value={item.material_lot_id}>{item.internal_lot_number ?? item.lot_number}</option>)}
                    </select>
                  </label>
                )}
                <p>The database assigns the Quality sample number and status. Collected-by is taken from the authenticated identity.</p>
                <FormActions onCancel={() => setQualityFormOpen(false)} saving={saving} />
              </form>
            )}

            {testFormOpen && (
              <form onSubmit={saveTestRequest}>
                <h2>Request Tests</h2>
                <label>Quality sample *
                  <select required value={testForm.quality_sample_id} onChange={(event) => setTestForm({ ...testForm, quality_sample_id: event.target.value, specification_revision_id: "" })}>
                    <option value="">Select sample</option>
                    {(testLookups?.quality_samples ?? []).map((item) => <option key={item.quality_sample_id} value={item.quality_sample_id}>{item.sample_number}{item.customer_sample_number ? ` — Customer ${item.customer_sample_number}` : ""} — {item.product_code} {item.product_name}</option>)}
                  </select>
                </label>
                <label>Approved effective specification revision *
                  <select required value={testForm.specification_revision_id} onChange={(event) => setTestForm({ ...testForm, specification_revision_id: event.target.value })}>
                    <option value="">Select revision</option>
                    {compatibleRevisions.map((item) => <option key={item.specification_revision_id} value={item.specification_revision_id}>{item.specification_code} rev {item.revision_no}</option>)}
                  </select>
                </label>
                <label>Test panel code *<input required maxLength={80} value={testForm.test_panel_code} onChange={(event) => setTestForm({ ...testForm, test_panel_code: event.target.value })} /></label>
                <p>Request status and timestamp are assigned by the database. Use the panel code approved by Quality; no panel catalogue is available in the current API.</p>
                <FormActions onCancel={() => setTestFormOpen(false)} saving={saving} />
              </form>
            )}

            {attemptFormOpen && (
              <form onSubmit={startAttempt}>
                <h2>Start Test Attempt</h2>
                <label>Attempt number *<input required type="number" min={1} step={1} value={attemptForm.attempt_no} onChange={(event) => setAttemptForm({ ...attemptForm, attempt_no: event.target.value })} /></label>
                <label>Test code *<input required maxLength={80} value={attemptForm.test_code} onChange={(event) => setAttemptForm({ ...attemptForm, test_code: event.target.value })} /></label>
                <p>Use the attempt number assigned by the approved lab workflow. Start time and analyst are recorded by the server.</p>
                <FormActions onCancel={() => setAttemptFormOpen(false)} saving={saving} />
              </form>
            )}

            {resultAttempt && (
              <form onSubmit={saveAttemptResults}>
                <h2>Enter Results — Attempt {resultAttempt.attempt_no}</h2>
                <label>Numeric result<input type="number" step="any" value={resultForm.result_value} onChange={(event) => setResultForm({ ...resultForm, result_value: event.target.value })} /></label>
                <label>Text result<textarea value={resultForm.result_text} onChange={(event) => setResultForm({ ...resultForm, result_text: event.target.value })} /></label>
                <label>Structured result (JSON)<textarea value={resultForm.result_data} onChange={(event) => setResultForm({ ...resultForm, result_data: event.target.value })} /></label>
                <label>Result unit
                  <select value={resultForm.result_uom_id} onChange={(event) => setResultForm({ ...resultForm, result_uom_id: event.target.value })}>
                    <option value="">None</option>
                    {(testLookups?.uoms ?? []).map((item) => <option key={item.uom_id} value={item.uom_id}>{item.uom_code} — {item.uom_name}</option>)}
                  </select>
                </label>
                <p>Completed attempts are read-only; create a new attempt for retesting.</p>
                <FormActions onCancel={() => setResultAttempt(null)} saving={saving} submitLabel="Save Results" />
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function FormActions({
  onCancel,
  saving,
  submitLabel = "Save",
}: {
  onCancel: () => void;
  saving: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="table-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" className="primary-button" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
