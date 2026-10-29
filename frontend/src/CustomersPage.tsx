import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import "./CustomersPage.css";
type Customer = {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  country_code?: string | null;
  address?: string | null;
  contact_email?: string | null;
  is_active: boolean;
  customer_category?: string | null;
  customer_industry?: string | null;
  key_account_flag?: boolean;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
};

type Address = {
  customer_address_id: string;
  address_type: string;
  address_line_1: string;
  address_line_2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country: string;
  is_primary_address: boolean;
  is_active: boolean;
};

type Contact = {
  customer_contact_id: string;
  contact_code?: string | null;
  first_name: string;
  last_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  email?: string | null;
  phone_number?: string | null;
  mobile_number?: string | null;
  is_primary_contact: boolean;
  is_active: boolean;
};

type Interaction = {
  interaction_id: string;
  interaction_number: string;
  interaction_type: string;
  subject: string;
  interaction_date: string;
  summary?: string | null;
  outcome?: string | null;
  next_action?: string | null;
  next_action_due_date?: string | null;
};

type PageTab =
  | "Overview"
  | "Addresses"
  | "Contacts"
  | "Commercial & Credit Profile"
  | "Interactions";

type ListResponse<T> = { items: T[]; total?: number };

const tabs: PageTab[] = [
  "Overview",
  "Addresses",
  "Contacts",
  "Commercial & Credit Profile",
  "Interactions",
];

const emptyCustomer = {
  customer_code: "",
  customer_name: "",
  country_code: "",
  address: "",
  contact_email: "",
  is_active: true,
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function dateText(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<PageTab>("Overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyCustomer });

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [commercialProfile, setCommercialProfile] = useState<Record<string, unknown> | null>(null);
  const [creditProfile, setCreditProfile] = useState<Record<string, unknown> | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [creditError, setCreditError] = useState("");

  const pageSize = 25;

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<ListResponse<Customer>>(
        "/api/commercial-customers",
        {
          params: {
            limit: pageSize,
            offset,
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(categoryFilter ? { category: categoryFilter } : {}),
            ...(statusFilter === "all"
              ? {}
              : { is_active: statusFilter === "active" }),
          },
        },
      );
      setCustomers(response.data.items ?? []);
      setTotal(response.data.total ?? 0);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Unable to load customers. Check your session and API connection.",
      );
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, search, categoryFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustomers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  const loadCustomerDetails = useCallback(async (customer: Customer) => {
    setDetailLoading(true);
    setDetailError("");
    setCreditError("");
    setAddresses([]);
    setContacts([]);
    setCommercialProfile(null);
    setCreditProfile(null);
    setInteractions([]);

    const requests = await Promise.allSettled([
      api.get<ListResponse<Address>>(
        `/api/commercial-customers/${customer.customer_id}/addresses`,
      ),
      api.get<ListResponse<Contact>>(
        `/api/commercial-customers/${customer.customer_id}/contacts`,
      ),
      api.get<Record<string, unknown> | null>(
        `/api/commercial-customers/${customer.customer_id}/commercial-profile`,
      ),
      api.get<Record<string, unknown> | null>(
        `/api/commercial-customers/${customer.customer_id}/credit-profile`,
      ),
      api.get<ListResponse<Interaction>>(
        `/api/commercial-customers/${customer.customer_id}/interactions`,
      ),
    ]);

    if (requests[0].status === "fulfilled") {
      setAddresses(requests[0].value.data.items ?? []);
    } else {
      setDetailError("Some customer details could not be loaded. Check your access and try refreshing.");
    }

    if (requests[1].status === "fulfilled") {
      setContacts(requests[1].value.data.items ?? []);
    } else {
      setDetailError("Some customer details could not be loaded. Check your access and try refreshing.");
    }

    if (requests[2].status === "fulfilled") {
      setCommercialProfile(requests[2].value.data);
    } else {
      setDetailError("Commercial profile is unavailable or access was denied.");
    }

    if (requests[3].status === "fulfilled") {
      setCreditProfile(requests[3].value.data);
    } else {
      setCreditError("Credit information is restricted or unavailable for your role.");
    }

    if (requests[4].status === "fulfilled") {
      setInteractions(requests[4].value.data.items ?? []);
    } else {
      setDetailError("Interaction history is unavailable or access was denied.");
    }

    setDetailLoading(false);
  }, []);

  useEffect(() => {
    if (selected) void loadCustomerDetails(selected);
  }, [selected, loadCustomerDetails]);

  const openCreate = () => {
    setForm({ ...emptyCustomer });
    setError("");
    setCreateOpen(true);
  };

  const createCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        customer_code: form.customer_code.trim(),
        customer_name: form.customer_name.trim(),
        country_code: form.country_code.trim() || null,
        address: form.address.trim() || null,
        contact_email: form.contact_email.trim() || null,
      };
      const response = await api.post<Customer>(
        "/api/commercial-customers",
        payload,
      );
      setCreateOpen(false);
      setSelected(response.data);
      setActiveTab("Overview");
      setOffset(0);
      await loadCustomers();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          "Unable to create customer. Check required fields and permissions.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openCustomer = (customer: Customer) => {
    setSelected(customer);
    setActiveTab("Overview");
  };

  const stats = {
    total,
    active: customers.filter((customer) => customer.is_active).length,
    inactive: customers.filter((customer) => !customer.is_active).length,
    keyAccounts: customers.filter((customer) => customer.key_account_flag).length,
  };

  return (
    <div className="page-content customer-management">
      <div className="page-header">
        <div>
          <h1>Customer Management</h1>
          <p>Customer master data, contacts and commercial relationships.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>
          + Create Customer
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Matching Customers</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Active on This Page</span>
          <strong>{stats.active}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Inactive on This Page</span>
          <strong>{stats.inactive}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Key Accounts on This Page</span>
          <strong>{stats.keyAccounts}</strong>
        </div>
      </div>

      <div className="data-panel">
        <div className="panel-header">
          <div>
            <h2>Customer Directory</h2>
            <p>Search the customer master and open a record to view its tabs.</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => void loadCustomers()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="filter-row">
          <input
            className="form-input"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search customer code, name or email..."
            aria-label="Search customers"
          />
          <select
            className="form-input"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setOffset(0);
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            <option value="Pharmaceutical">Pharmaceutical</option>
            <option value="Distributor">Distributor</option>
            <option value="Hospital">Hospital</option>
            <option value="API Manufacturer">API Manufacturer</option>
            <option value="Contract Manufacturer">Contract Manufacturer</option>
          </select>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setOffset(0);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Customer Name</th>
                <th>Category</th>
                <th>Country</th>
                <th>Contact Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading customers...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7}>No customers found for these filters.</td></tr>
              ) : customers.map((customer) => (
                <tr key={customer.customer_id}>
                  <td><strong>{customer.customer_code}</strong></td>
                  <td>{customer.customer_name}</td>
                  <td>{display(customer.customer_category)}</td>
                  <td>{display(customer.country_code)}</td>
                  <td>{display(customer.contact_email)}</td>
                  <td>
                    <span className="status-pill">
                      {customer.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="secondary-button" onClick={() => openCustomer(customer)}>
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="customer-pagination">
          <span>
            {total === 0 ? "0 customers" : `${offset + 1}–${Math.min(offset + pageSize, total)} of ${total}`}
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
      </div>

      {selected && (
        <div className="data-panel customer-detail-panel">
          <div className="panel-header">
            <div>
              <p className="customer-detail-eyebrow">CUSTOMER RECORD</p>
              <h2>{selected.customer_name}</h2>
              <p>{selected.customer_code} · {selected.is_active ? "Active" : "Inactive"}</p>
            </div>
            <div className="table-actions">
              <button
                className="secondary-button"
                onClick={() => void loadCustomerDetails(selected)}
                disabled={detailLoading}
              >
                {detailLoading ? "Refreshing..." : "Refresh details"}
              </button>
              <button className="secondary-button" onClick={() => setSelected(null)}>
                Close record
              </button>
            </div>
          </div>

          <div className="customer-tabs" role="tablist" aria-label="Customer detail tabs">
            {tabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`customer-tab${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {detailError && <div className="form-error">{detailError}</div>}
          {detailLoading ? (
            <p className="customer-state">Loading customer details...</p>
          ) : (
            <>
              {activeTab === "Overview" && (
                <div className="customer-tab-content">
                  <h3>Customer identity</h3>
                  <div className="customer-info-grid">
                    <Info label="Customer code" value={selected.customer_code} />
                    <Info label="Customer name" value={selected.customer_name} />
                    <Info label="Country code" value={selected.country_code} />
                    <Info label="Contact email" value={selected.contact_email} />
                    <Info label="Legacy / summary address" value={selected.address} />
                    <Info label="Category" value={selected.customer_category} />
                    <Info label="Industry" value={selected.customer_industry} />
                    <Info label="Key account" value={selected.key_account_flag} />
                    <Info label="Created" value={dateText(selected.created_at)} />
                    <Info label="Updated" value={dateText(selected.updated_at)} />
                    <Info label="Created by (user ID)" value={selected.created_by} />
                    <Info label="Updated by (user ID)" value={selected.updated_by} />
                  </div>

                  <h3>Primary address</h3>
                  {addresses.find((address) => address.is_primary_address) ? (
                    <AddressCard address={addresses.find((address) => address.is_primary_address)!} />
                  ) : (
                    <p className="customer-state">No primary address is recorded.</p>
                  )}

                  <h3>Primary contact</h3>
                  {contacts.find((contact) => contact.is_primary_contact) ? (
                    <ContactCard contact={contacts.find((contact) => contact.is_primary_contact)!} />
                  ) : (
                    <p className="customer-state">No primary contact is recorded.</p>
                  )}
                </div>
              )}

              {activeTab === "Addresses" && (
                <div className="customer-tab-content">
                  <div className="panel-header">
                    <div><h3>Addresses</h3><p>Address records stored separately from the legacy summary address.</p></div>
                    <span className="customer-count">{addresses.length} records</span>
                  </div>
                  {addresses.length === 0 ? (
                    <p className="customer-state">No addresses have been recorded.</p>
                  ) : (
                    <div className="customer-record-grid">
                      {addresses.map((address) => (
                        <AddressCard key={address.customer_address_id} address={address} />
                      ))}
                    </div>
                  )}
                  <p className="customer-note">Address editing will be enabled after its API endpoints and permissions are implemented.</p>
                </div>
              )}

              {activeTab === "Contacts" && (
                <div className="customer-tab-content">
                  <div className="panel-header">
                    <div><h3>Contacts</h3><p>People associated with this customer.</p></div>
                    <span className="customer-count">{contacts.length} records</span>
                  </div>
                  {contacts.length === 0 ? (
                    <p className="customer-state">No contacts have been recorded.</p>
                  ) : (
                    <div className="customer-record-grid">
                      {contacts.map((contact) => (
                        <ContactCard key={contact.customer_contact_id} contact={contact} />
                      ))}
                    </div>
                  )}
                  <p className="customer-note">Contact editing will be enabled after its API endpoints and permissions are implemented.</p>
                </div>
              )}

              {activeTab === "Commercial & Credit Profile" && (
                <div className="customer-tab-content">
                  <h3>Commercial profile</h3>
                  {commercialProfile ? (
                    <div className="customer-info-grid">
                      <Info label="Customer category" value={commercialProfile.customer_category} />
                      <Info label="Industry" value={commercialProfile.customer_industry} />
                      <Info label="Regulatory classification" value={commercialProfile.regulatory_classification} />
                      <Info label="Payment terms code" value={commercialProfile.payment_terms} />
                      <Info label="Currency code" value={commercialProfile.credit_currency} />
                      <Info label="Key account" value={commercialProfile.key_account_flag} />
                      <Info label="Effective from" value={dateText(String(commercialProfile.effective_from ?? ""))} />
                      <Info label="Effective to" value={dateText(String(commercialProfile.effective_to ?? ""))} />
                    </div>
                  ) : (
                    <p className="customer-state">No commercial profile is available, or access was denied.</p>
                  )}

                  <div className="customer-section-divider" />
                  <h3>Credit control <span className="customer-readonly-label">Read only</span></h3>
                  {creditError && <div className="form-error">{creditError}</div>}
                  {creditProfile ? (
                    <div className="customer-info-grid">
                      <Info label="Credit limit" value={creditProfile.credit_limit} />
                      <Info label="Currency code" value={creditProfile.credit_currency_code} />
                      <Info label="Current exposure" value={creditProfile.current_exposure} />
                      <Info label="Available credit" value={creditProfile.available_credit} />
                      <Info label="Credit status" value={creditProfile.credit_status} />
                      <Info label="Payment risk class" value={creditProfile.payment_risk_class} />
                      <Info label="Credit hold" value={creditProfile.credit_hold_flag} />
                      <Info label="Effective from" value={dateText(String(creditProfile.effective_from ?? ""))} />
                      <Info label="Approved at" value={dateText(String(creditProfile.approved_at ?? ""))} />
                    </div>
                  ) : (
                    <p className="customer-state">Credit data is restricted to authorized roles. No credit changes are available here.</p>
                  )}
                </div>
              )}

              {activeTab === "Interactions" && (
                <div className="customer-tab-content">
                  <div className="panel-header">
                    <div><h3>Interactions</h3><p>Recent customer-related interaction history.</p></div>
                    <span className="customer-count">{interactions.length} records</span>
                  </div>
                  {interactions.length === 0 ? (
                    <p className="customer-state">No interactions found, or the interaction history is unavailable.</p>
                  ) : (
                    <div className="responsive-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Interaction No.</th>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Subject</th>
                            <th>Outcome</th>
                            <th>Next Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {interactions.map((item) => (
                            <tr key={item.interaction_id}>
                              <td>{item.interaction_number}</td>
                              <td>{dateText(item.interaction_date)}</td>
                              <td>{item.interaction_type}</td>
                              <td>{item.subject}</td>
                              <td>{display(item.outcome)}</td>
                              <td>{display(item.next_action)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="customer-note">Creating interactions requires a valid related document version and is not enabled in this screen.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {createOpen && (
        <div className="modal-overlay" onClick={() => !saving && setCreateOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Create Customer</h2>
                <p>Create the master record before adding addresses or contacts.</p>
              </div>
              <button className="secondary-button" onClick={() => setCreateOpen(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form onSubmit={createCustomer}>
              <div className="form-grid">
                <div>
                  <label htmlFor="new-customer-code">Customer code *</label>
                  <input
                    id="new-customer-code"
                    className="form-input"
                    required
                    maxLength={100}
                    value={form.customer_code}
                    onChange={(event) => setForm((current) => ({ ...current, customer_code: event.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="new-customer-name">Customer name *</label>
                  <input
                    id="new-customer-name"
                    className="form-input"
                    required
                    maxLength={200}
                    value={form.customer_name}
                    onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="new-customer-country">Country code</label>
                  <input
                    id="new-customer-country"
                    className="form-input"
                    maxLength={10}
                    placeholder="Select a valid reference country code"
                    value={form.country_code}
                    onChange={(event) => setForm((current) => ({ ...current, country_code: event.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="new-customer-email">Contact email</label>
                  <input
                    id="new-customer-email"
                    type="email"
                    className="form-input"
                    value={form.contact_email}
                    onChange={(event) => setForm((current) => ({ ...current, contact_email: event.target.value }))}
                  />
                </div>
                <div className="form-grid-full">
                  <label htmlFor="new-customer-address">Legacy / summary address</label>
                  <textarea
                    id="new-customer-address"
                    className="form-input"
                    rows={3}
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  />
                </div>
                <div className="form-grid-full">
                  <label className="customer-checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    Active customer
                  </label>
                </div>
              </div>

              {error && <div className="form-error">{error}</div>}
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="customer-info-item">
      <span>{label}</span>
      <strong>{display(value)}</strong>
    </div>
  );
}

function AddressCard({ address }: { address: Address }) {
  return (
    <article className="customer-record-card">
      <div className="customer-card-heading">
        <h4>{address.address_type}</h4>
        <span className="status-pill">{address.is_active ? "Active" : "Inactive"}</span>
      </div>
      <p>{address.address_line_1}</p>
      {address.address_line_2 && <p>{address.address_line_2}</p>}
      <p>{[address.city, address.state_province, address.postal_code].filter(Boolean).join(", ") || "—"}</p>
      <p>{address.country}</p>
      {address.is_primary_address && <span className="customer-primary-label">Primary address</span>}
    </article>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <article className="customer-record-card">
      <div className="customer-card-heading">
        <h4>{[contact.first_name, contact.last_name].filter(Boolean).join(" ")}</h4>
        <span className="status-pill">{contact.is_active ? "Active" : "Inactive"}</span>
      </div>
      <p>{display(contact.job_title)}{contact.department ? ` · ${contact.department}` : ""}</p>
      <p>{display(contact.email)}</p>
      <p>{display(contact.phone_number)}{contact.mobile_number ? ` · ${contact.mobile_number}` : ""}</p>
      {contact.is_primary_contact && <span className="customer-primary-label">Primary contact</span>}
    </article>
  );
}
