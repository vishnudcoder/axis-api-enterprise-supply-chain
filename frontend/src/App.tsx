import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  Menu,
  ShieldAlert,
  X,
  ArrowUpRight,
  Factory,
  PackageCheck,
  AlertTriangle,
  TrendingUp,
  CircleDot,
  ClipboardCheck,
  Truck,
  Boxes,
} from "lucide-react";

import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import { api } from "./api";
import { useAuth } from "./auth";

import LeadsPage from "./LeadsPage";
import PurchaseOrdersPage from "./PurchaseOrdersPage";
import OrderManagementPage from "./OrderManagementPage";
import PPICPage from "./PPICPage";
import ProductionPage from "./ProductionPage";
import ReactorsPage from "./ReactorsPage";
import EquipmentPage from "./EquipmentPage";
import StockManagementPage from "./StockManagementPage";
import SupplyChainPage from "./SupplyChainPage";
import COAPage from "./COAPage";
import SamplesPage from "./SamplesPage";
import QuotesPage from "./QuotesPage";
import MDCommercialPage from "./MDCommercialPage";

import {
  NAV_ITEMS,
  ROLE_DESCRIPTIONS,
  ROLE_NAMES,
} from "./navigation";


/* ============================================================
   LOGIN PAGE
============================================================ */

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("admin@axis.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (error: any) {
      const detail = error?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(
          detail
            .map(
              (item) =>
                item?.msg ||
                "Invalid login request."
            )
            .join(", ")
        );
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(
          "Unable to sign in. Check the backend is running."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form
        className="login-card"
        onSubmit={submit}
      >
        <div className="brand-mark">
          AXIS API
        </div>

        <div className="brand-subtitle">
          LEAD → PO → PLANT
        </div>

        <div className="login-heading">
          <h1>Welcome back</h1>
          <p>
            Sign in to pharmaceutical operations.
          </p>
        </div>

        <label>
          Email

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <button
          className="primary-button full-width"
          disabled={busy}
        >
          {busy
            ? "Signing in…"
            : "Sign In"}
        </button>

        <div className="demo-hint">
          Demo admin: admin@axis.local / Admin@123
        </div>
      </form>
    </main>
  );
}


/* ============================================================
   APP SHELL
============================================================ */

function AppShell() {
  const {
    user,
    logout,
    can,
    switchDemoRole,
  } = useAuth();

  const [drawerOpen, setDrawerOpen] =
    useState(false);

  const [roleOpen, setRoleOpen] =
    useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => can(item.page)
  );

  const groups = [
    ...new Set(
      visibleItems.map(
        (item) => item.group
      )
    ),
  ];

  return (
    <div className="app-shell">

      {drawerOpen && (
        <button
          className="drawer-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setDrawerOpen(false)
          }
        />
      )}

      <aside
        className={`sidebar ${
          drawerOpen
            ? "sidebar-open"
            : ""
        }`}
      >

        <div className="sidebar-brand-row">
          <div>
            <div className="brand-mark">
              AXIS API
            </div>

            <div className="brand-subtitle">
              LEAD → PO → PLANT
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={() =>
              setDrawerOpen(false)
            }
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>


        <div className="signed-in">

          <div className="section-label">
            SIGNED IN AS
          </div>

          <button
            className="role-selector"
            onClick={() =>
              setRoleOpen(
                (value) => !value
              )
            }
            aria-expanded={roleOpen}
          >
            <span>
              {user?.role.name}
            </span>

            <ChevronDown size={16} />
          </button>


          {roleOpen && (
            <div className="role-dropdown">

              {ROLE_NAMES.map(
                (role) => (
                  <button
                    key={role}
                    className={
                      role ===
                      user?.role.name
                        ? "role-option selected"
                        : "role-option"
                    }
                    onClick={() => {
                      switchDemoRole(role);
                      setRoleOpen(false);
                    }}
                  >
                    <span>
                      {role}
                    </span>

                    {role ===
                      user?.role.name && (
                      <span>✓</span>
                    )}
                  </button>
                )
              )}

              <div className="role-description">
                {
                  ROLE_DESCRIPTIONS[
                    user?.role.name ||
                      ""
                  ]
                }
              </div>

            </div>
          )}

        </div>


        <nav className="sidebar-nav">

          {groups.map(
            (group) => (
              <div
                className="nav-group"
                key={group}
              >

                <div className="section-label nav-group-title">
                  {group}
                </div>

                {visibleItems
                  .filter(
                    (item) =>
                      item.group ===
                      group
                  )
                  .map((item) => {

                    const Icon =
                      item.icon;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() =>
                          setDrawerOpen(
                            false
                          )
                        }
                        className={({
                          isActive,
                        }) =>
                          `nav-link ${
                            isActive
                              ? "active"
                              : ""
                          }`
                        }
                      >
                        <Icon
                          size={17}
                          strokeWidth={1.8}
                        />

                        <span>
                          {item.label}
                        </span>
                      </NavLink>
                    );
                  })}

              </div>
            )
          )}


          {user?.role.name ===
            "Plant Head / Admin" && (

            <NavLink
              to="/users"
              onClick={() =>
                setDrawerOpen(false)
              }
              className={({ isActive }) =>
                `nav-link admin-nav ${
                  isActive
                    ? "active"
                    : ""
                }`
              }
            >
              <ShieldAlert
                size={17}
                strokeWidth={1.8}
              />

              <span>
                User Management
              </span>
            </NavLink>
          )}

        </nav>


        <button
          className="sign-out"
          onClick={logout}
        >
          Sign out
        </button>

      </aside>


      <div className="main-area">

        <header className="top-header">

          <button
            className="hamburger"
            onClick={() =>
              setDrawerOpen(true)
            }
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>

          <div className="mobile-brand">
            AXIS API
          </div>

          <div className="header-right">

            <button
              className="notification-button"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className="notification-dot" />
            </button>

            <div className="desktop-user">
              <strong>
                {user?.full_name}
              </strong>

              <span>
                {user?.role.name}
              </span>
            </div>

          </div>

        </header>


        <div className="content">
          <Outlet />
        </div>

      </div>

    </div>
  );
}


/* ============================================================
   PROTECTED LAYOUT
============================================================ */

function ProtectedLayout() {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        Loading AXIS API…
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <AppShell />;
}


/* ============================================================
   ACCESS GUARD
============================================================ */

function AccessGuard({
  page,
  children,
}: {
  page: string;
  children: ReactNode;
}) {
  const { user, can } =
    useAuth();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (!can(page)) {
    return (
      <section className="access-denied">

        <ShieldAlert size={46} />

        <h1>
          Access Denied
        </h1>

        <p>
          Your current role does not
          have access to this module.
        </p>

        <NavLink
          to="/"
          className="primary-button"
        >
          Back to Dashboard
        </NavLink>

      </section>
    );
  }

  return <>{children}</>;
}


/* ============================================================
   PAGE HEADER
============================================================ */

function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-header">
      <div>

        <h1>{title}</h1>

        <p>{subtitle}</p>

      </div>
    </div>
  );
}


/* ============================================================
   DASHBOARD
============================================================ */

function DashboardPage() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [leadSummary, setLeadSummary] = useState<any>(null);
  const [poSummary, setPoSummary] = useState<any>(null);
  const [reactorSummary, setReactorSummary] = useState<any>(null);
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [supplySummary, setSupplySummary] = useState<any>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [reactors, setReactors] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function extractItems(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

  function formatApiError(err: any, fallback: string) {
    const detail = err?.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item: any) => item?.msg || fallback)
        .join(", ");
    }

    if (typeof detail === "string") return detail;

    return fallback;
  }

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError("");

      const requests: Promise<any>[] = [
        api.get("/api/leads/summary"),
      ];

      if (can("Purchase Orders")) {
        requests.push(api.get("/api/purchase-orders/summary"));
        requests.push(
          api.get("/api/purchase-orders", {
            params: { page: 1, page_size: 4 },
          }),
        );
      }

      if (can("Reactors")) {
        requests.push(api.get("/api/reactors/summary"));
        requests.push(
          api.get("/api/reactors", {
            params: { page: 1, page_size: 6 },
          }),
        );
      }

      if (can("Stock Management")) {
        requests.push(api.get("/api/stock/summary"));
      }

      if (can("Supply Chain")) {
        requests.push(api.get("/api/supply-chain/summary"));
      }

      const responses = await Promise.all(requests);

      let index = 0;

      setLeadSummary(responses[index++].data);

      if (can("Purchase Orders")) {
        setPoSummary(responses[index++].data);
        setOrders(extractItems(responses[index++].data));
      } else {
        setPoSummary(null);
        setOrders([]);
      }

      if (can("Reactors")) {
        setReactorSummary(responses[index++].data);
        setReactors(extractItems(responses[index++].data));
      } else {
        setReactorSummary(null);
        setReactors([]);
      }

      if (can("Stock Management")) {
        setStockSummary(responses[index++].data);
      } else {
        setStockSummary(null);
      }

      if (can("Supply Chain")) {
        setSupplySummary(responses[index++].data);
      } else {
        setSupplySummary(null);
      }
    } catch (err: any) {
      console.error("Dashboard data error:", err);
      setError(
        formatApiError(
          err,
          "Unable to load live dashboard data.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, [can]);

  const money = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);

  const pipelineValue = Number(leadSummary?.pipeline_value || 0);
  const totalEnquiries = Number(leadSummary?.total_enquiries || 0);
  const regulatedMarkets = Number(leadSummary?.regulated_markets || 0);
  const techPackPending = Number(leadSummary?.tech_pack_pending || 0);
  const developmentEnquiries = Number(
    leadSummary?.development_enquiries || 0,
  );

  const funnel = Array.isArray(leadSummary?.funnel)
    ? leadSummary.funnel
    : [];

  const maxFunnelCount = Math.max(
    ...funnel.map((item: any) => Number(item.count || 0)),
    1,
  );

  const totalOrders = Number(poSummary?.total_orders || 0);
  const poPipelineValue = Number(poSummary?.pipeline_value || 0);
  const inProduction = Number(poSummary?.in_production || 0);

  const totalReactors = Number(reactorSummary?.total || 0);
  const engagedReactors = Number(reactorSummary?.engaged || 0);

  const lowStock = Number(stockSummary?.low_stock || 0);
  const outOfStock = Number(stockSummary?.out_of_stock || 0);
  const materialAlerts = lowStock + outOfStock;

  const totalShipments = Number(
    supplySummary?.total_shipments ??
      supplySummary?.total ??
      0,
  );
  const openShipments = Number(
    supplySummary?.open_shipments ??
      supplySummary?.in_transit ??
      0,
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Operations Dashboard</h1>
          <p>Enquiry to dispatch, one thread per molecule.</p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={loadDashboardData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          className="form-error"
          style={{ marginBottom: "18px" }}
        >
          {error}
        </div>
      )}

      <section className="kpi-grid dashboard-kpis">
        <KpiCard
          label="OPEN PIPELINE"
          value={loading ? "—" : money(pipelineValue)}
          note={
            loading
              ? "Loading commercial pipeline..."
              : `${totalEnquiries} active enquiries`
          }
          icon={<TrendingUp />}
          onClick={() => navigate("/leads")}
        />

        <KpiCard
          label="CONFIRMED POS"
          value={
            loading
              ? "—"
              : can("Purchase Orders")
                ? money(poPipelineValue)
                : "—"
          }
          note={
            loading
              ? "Loading purchase orders..."
              : can("Purchase Orders")
                ? `${totalOrders} active orders`
                : "Not available for this role"
          }
          icon={<ClipboardCheck />}
          onClick={can("Purchase Orders") ? () => navigate("/purchase-orders") : undefined}
        />

        <KpiCard
          label="REACTORS ENGAGED"
          value={
            loading
              ? "—"
              : can("Reactors")
                ? `${engagedReactors}/${totalReactors}`
                : "—"
          }
          note={
            loading
              ? "Loading reactor status..."
              : can("Reactors")
                ? "Across current production"
                : "Not available for this role"
          }
          icon={<Factory />}
          onClick={can("Reactors") ? () => navigate("/reactors") : undefined}
        />

        <KpiCard
          label="MATERIAL ALERTS"
          value={
            loading
              ? "—"
              : can("Stock Management")
                ? String(materialAlerts)
                : "—"
          }
          note={
            loading
              ? "Loading inventory alerts..."
              : can("Stock Management")
                ? `${lowStock} low stock · ${outOfStock} out of stock`
                : "Not available for this role"
          }
          icon={<AlertTriangle />}
          onClick={can("Stock Management") ? () => navigate("/stock") : undefined}
        />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel">
          <div className="panel-title-row">
            <div>
              <h2>Commercial funnel</h2>
              <p>Current enquiry progression by value.</p>
            </div>
            <ArrowUpRight size={18} />
          </div>

          <div className="funnel-list">
            {loading ? (
              <div className="table-loading">
                Loading commercial funnel...
              </div>
            ) : funnel.length === 0 ? (
              <div className="empty-state">
                <h3>No funnel data</h3>
                <p>No enquiries are currently available.</p>
              </div>
            ) : (
              funnel.map((item: any, index: number) => {
                const count = Number(item.count || 0);
                const value = Number(item.value || 0);
                const percentage = Math.round(
                  (count / maxFunnelCount) * 100,
                );

                return (
                  <div
                    className="funnel-row"
                    key={item.stage}
                  >
                    <div className="funnel-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="funnel-main">
                      <strong>{item.stage}</strong>
                      <span>
                        {count}{" "}
                        {count === 1 ? "enquiry" : "enquiries"}
                      </span>

                      <div className="progress-track">
                        <span
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    <strong>{money(value)}</strong>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-title-row">
            <div>
              <h2>Operations status</h2>
              <p>Live attention areas across the plant.</p>
            </div>
          </div>

          <div className="status-summary">
            <StatusSummary
              icon={<CircleDot />}
              label="Commercial"
              value={
                loading
                  ? "Loading..."
                  : `${totalEnquiries} active enquiries`
              }
              tone="good"
            />

            <StatusSummary
              icon={<PackageCheck />}
              label="Quality"
              value={
                loading
                  ? "Loading..."
                  : `${techPackPending} tech-pack pending`
              }
              tone="warn"
            />

            <StatusSummary
              icon={<Boxes />}
              label="Inventory"
              value={
                loading
                  ? "Loading..."
                  : can("Stock Management")
                    ? `${materialAlerts} material alerts`
                    : "Not available for this role"
              }
              tone="warn"
            />

            <StatusSummary
              icon={<Truck />}
              label="Logistics"
              value={
                loading
                  ? "Loading..."
                  : can("Supply Chain")
                    ? `${openShipments || totalShipments} open shipments`
                    : "Not available for this role"
              }
              tone="good"
            />
          </div>
        </article>
      </section>

      <section className="dashboard-grid lower-grid">
        <article className="dashboard-panel">
          <div className="panel-title-row">
            <div>
              <h2>Latest POs</h2>
              <p>
                Confirmed orders requiring operational follow-through.
              </p>
            </div>

            <NavLink
              to="/purchase-orders"
              className="panel-link"
            >
              View all
            </NavLink>
          </div>

          <div className="responsive-table compact-table">
            <table>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT</th>
                  <th>VALUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {!can("Purchase Orders") ? (
                  <tr>
                    <td colSpan={5}>
                      Purchase order data is not available for this role.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={5}>Loading purchase orders...</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No purchase orders available.</td>
                  </tr>
                ) : (
                  orders.slice(0, 4).map((order: any) => {
                    const status = order.status || "Unknown";

                    return (
                      <tr
                        key={order.id ?? order.po_number}
                        className="dashboard-clickable-row"
                        onClick={() => navigate("/purchase-orders")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigate("/purchase-orders");
                          }
                        }}
                      >
                        <td>{order.po_number || "—"}</td>
                        <td>{order.customer || "—"}</td>
                        <td>{order.product || "—"}</td>
                        <td>
                          {money(Number(order.value_usd || 0))}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${status
                              .toLowerCase()
                              .replace(/ /g, "-")}`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-title-row">
            <div>
              <h2>Plant snapshot</h2>
              <p>Current reactor activity and progress.</p>
            </div>

            <NavLink
              to="/reactors"
              className="panel-link"
            >
              Open reactors
            </NavLink>
          </div>

          <div className="reactor-list">
            {!can("Reactors") ? (
              <div className="empty-state">
                <h3>Reactor data unavailable</h3>
                <p>Your current role does not have reactor visibility.</p>
              </div>
            ) : loading ? (
              <div className="table-loading">
                Loading reactor snapshot...
              </div>
            ) : reactors.length === 0 ? (
              <div className="empty-state">
                <h3>No reactors available</h3>
                <p>No reactor records are currently available.</p>
              </div>
            ) : (
              reactors.slice(0, 6).map((reactor: any) => {
                const utilization = Math.max(
                  0,
                  Math.min(
                    100,
                    Number(reactor.utilization_percent || 0),
                  ),
                );

                return (
                  <div
                    className="reactor-row dashboard-clickable-row"
                    key={reactor.id ?? reactor.reactor_code}
                    onClick={() => navigate("/reactors")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate("/reactors");
                      }
                    }}
                  >
                    <div>
                      <strong>
                        {reactor.reactor_code || "—"}
                      </strong>
                      <span>
                        {reactor.current_batch || "—"}
                      </span>
                    </div>

                    <div>
                      <span className="reactor-stage">
                        {reactor.status || "Unknown"}
                      </span>

                      <div className="progress-track">
                        <span
                          style={{
                            width: `${utilization}%`,
                          }}
                        />
                      </div>
                    </div>

                    <strong>{utilization}%</strong>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-panel">
        <div className="panel-title-row">
          <div>
            <h2>Commercial summary</h2>
            <p>Live metrics from the Leads database.</p>
          </div>
        </div>

        <div className="kpi-grid">
          <KpiCard
            label="ACTIVE ENQUIRIES"
            value={loading ? "—" : String(totalEnquiries)}
            note="Live from Leads"
          />

          <KpiCard
            label="PIPELINE VALUE"
            value={loading ? "—" : money(pipelineValue)}
            note="Current enquiry value"
          />

          <KpiCard
            label="REGULATED MARKETS"
            value={loading ? "—" : String(regulatedMarkets)}
            note="US, EU and Japan"
          />

          <KpiCard
            label="DEVELOPMENT"
            value={loading ? "—" : String(developmentEnquiries)}
            note="Development enquiries"
          />
        </div>
      </section>
    </>
  );
}


/* ============================================================
   STATUS SUMMARY
============================================================ */

function StatusSummary({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone:
    | "good"
    | "warn";
}) {
  return (
    <div className="status-summary-row">

      <span
        className={`status-icon ${tone}`}
      >
        {icon}
      </span>

      <div>
        <strong>
          {label}
        </strong>

        <span>
          {value}
        </span>
      </div>

    </div>
  );
}


/* ============================================================
   KPI CARD
============================================================ */

function KpiCard({
  label,
  value,
  note,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <article
      className={`kpi-card${onClick ? " dashboard-clickable" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >

      <div className="kpi-top">

        <div className="eyebrow">
          {label}
        </div>

        {icon && (
          <span className="kpi-icon">
            {icon}
          </span>
        )}

      </div>

      <strong>
        {value}
      </strong>

      <span>
        {note}
      </span>

    </article>
  );
}


/* ============================================================
   PAGE INFORMATION
============================================================ */

const PAGE_INFO: Record<
  string,
  {
    title: string;
    subtitle: string;
  }
> = {

  "MD Commercial View": {
    title:
      "MD Commercial View",
    subtitle:
      "Executive pipeline, quotes, conversion and delivery oversight.",
  },

  Leads: {
    title: "Leads",
    subtitle:
      "Customer enquiries and commercial pipeline.",
  },

  COA: {
    title: "COA",
    subtitle:
      "Certificate of Analysis and QA release workflow.",
  },

  Samples: {
    title: "Samples",
    subtitle:
      "Track customer samples from request to feedback.",
  },

  Quotes: {
    title: "Quotes",
    subtitle:
      "Versioned offers with commercial and regulatory terms.",
  },

  "Purchase Orders": {
    title:
      "Purchase Orders",
    subtitle:
      "Confirmed customer orders and delivery status.",
  },

  "Order Management": {
    title:
      "Order Management",
    subtitle:
      "One operational thread from PO through dispatch.",
  },

  PPIC: {
    title: "PPIC",
    subtitle:
      "Production planning, batches, reactors and material availability.",
  },

  Production: {
    title:
      "Production",
    subtitle:
      "Production batch execution, reactor operations and batch completion.",
  },

  Reactors: {
    title: "Reactors",
    subtitle:
      "Capacity, current batch, status and utilization.",
  },

  "Equipment & Utilities": {
    title:
      "Equipment & Utilities",
    subtitle:
      "Equipment health and maintenance readiness.",
  },

  "Stock Management": {
    title:
      "Stock Management",
    subtitle:
      "Lot-level inventory, availability and alerts.",
  },

  "Supply Chain": {
    title:
      "Supply Chain",
    subtitle:
      "Supplier, material, inbound and outbound logistics.",
  },
};


/* ============================================================
   MODULE PLACEHOLDER
============================================================ */

function ModulePage({
  page,
}: {
  page: string;
}) {
  const info = PAGE_INFO[page];

  return (
    <>
      <PageHeader
        title={info.title}
        subtitle={info.subtitle}
      />

      <div className="module-placeholder">

        <div className="module-icon">
          <BarChart3
            size={28}
          />
        </div>

        <h2>
          {info.title} module
        </h2>

        <p>
          Phase 1 establishes the real
          route, authentication and
          permission boundary. This
          module is intentionally the
          next implementation layer,
          not a fake static feature.
        </p>

      </div>
    </>
  );
}


/* ============================================================
   USERS PAGE
============================================================ */

function UsersPage() {
  const { can } =
    useAuth();

  const [users, setUsers] =
    useState<any[]>([]);

  const [roles, setRoles] =
    useState<any[]>([]);

  const [open, setOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState({
      full_name: "",
      email: "",
      password: "",
      employee_id: "",
      department: "",
      phone: "",
      role_name:
        "Sales & Marketing",
    });


  async function load() {

    const [
      usersResponse,
      rolesResponse,
    ] = await Promise.all([
      api.get("/api/users"),
      api.get("/api/roles"),
    ]);

    setUsers(
      usersResponse.data
    );

    setRoles(
      rolesResponse.data
    );
  }


  useEffect(() => {

    load().catch(
      (error) => {

        setError(
          error?.response?.data
            ?.detail ||
            "Unable to load users."
        );

      }
    );

  }, []);


  async function createUser(
    event: React.FormEvent
  ) {

    event.preventDefault();
    setError("");

    try {

      await api.post(
        "/api/users",
        form
      );

      setOpen(false);

      setForm({
        full_name: "",
        email: "",
        password: "",
        employee_id: "",
        department: "",
        phone: "",
        role_name:
          "Sales & Marketing",
      });

      await load();

    } catch (error: any) {

      setError(
        error?.response?.data
          ?.detail ||
          "Unable to create user."
      );

    }
  }


  if (!can("Dashboard")) {
    return null;
  }


  return (
    <>

      <div className="page-header">

        <div>

          <h1>
            User Management
          </h1>

          <p>
            Create users and assign operational roles.
          </p>

        </div>


        <button
          className="primary-button"
          onClick={() =>
            setOpen(true)
          }
        >
          + Add User
        </button>

      </div>


      {error && (
        <div className="form-error">
          {error}
        </div>
      )}


      <div className="data-panel">

        <div className="responsive-table">

          <table>

            <thead>

              <tr>
                <th>NAME</th>
                <th>EMAIL</th>
                <th>EMPLOYEE ID</th>
                <th>DEPARTMENT</th>
                <th>ROLE</th>
                <th>STATUS</th>
              </tr>

            </thead>


            <tbody>

              {users.map(
                (item) => (

                  <tr
                    key={item.id}
                  >

                    <td>
                      {item.full_name}
                    </td>

                    <td>
                      {item.email}
                    </td>

                    <td>
                      {item.employee_id ||
                        "—"}
                    </td>

                    <td>
                      {item.department ||
                        "—"}
                    </td>

                    <td>
                      {item.role.name}
                    </td>

                    <td>

                      <span className="status-pill">
                        {item.status}
                      </span>

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </div>


      {open && (

        <div className="modal-overlay">

          <form
            className="modal-card"
            onSubmit={createUser}
          >

            <div className="modal-header">

              <div>

                <h2>
                  Create User
                </h2>

                <p>
                  Assign one of the seven operational roles.
                </p>

              </div>


              <button
                type="button"
                className="icon-only"
                onClick={() =>
                  setOpen(false)
                }
              >
                <X />
              </button>

            </div>


            <div className="form-grid">

              {[
                [
                  "full_name",
                  "Full name",
                  "text",
                ],
                [
                  "email",
                  "Email",
                  "email",
                ],
                [
                  "password",
                  "Temporary password",
                  "password",
                ],
                [
                  "employee_id",
                  "Employee ID",
                  "text",
                ],
                [
                  "department",
                  "Department",
                  "text",
                ],
                [
                  "phone",
                  "Phone",
                  "text",
                ],
              ].map(
                ([
                  key,
                  label,
                  type,
                ]) => (

                  <label
                    key={key}
                  >

                    {label}

                    <input
                      type={type}
                      required={
                        key ===
                          "full_name" ||
                        key ===
                          "email" ||
                        key ===
                          "password"
                      }
                      value={
                        form[
                          key as keyof typeof form
                        ]
                      }
                      onChange={(
                        event
                      ) =>
                        setForm({
                          ...form,
                          [key]:
                            event
                              .target
                              .value,
                        })
                      }
                    />

                  </label>

                )
              )}


              <label>

                Role

                <select
                  value={
                    form.role_name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      role_name:
                        event
                          .target
                          .value,
                    })
                  }
                >

                  {roles.map(
                    (role) => (

                      <option
                        value={
                          role.name
                        }
                        key={
                          role.id
                        }
                      >
                        {role.name}
                      </option>

                    )
                  )}

                </select>

              </label>

            </div>


            <div className="modal-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setOpen(false)
                }
              >
                Cancel
              </button>

              <button className="primary-button">
                Create User
              </button>

            </div>

          </form>

        </div>

      )}

    </>
  );
}


/* ============================================================
   ADMIN GUARD
============================================================ */

function AdminGuard({
  children,
}: {
  children: ReactNode;
}) {
  const { user } =
    useAuth();

  if (
    user?.role.name !==
    "Plant Head / Admin"
  ) {

    return (
      <section className="access-denied">

        <ShieldAlert
          size={46}
        />

        <h1>
          Access Denied
        </h1>

        <p>
          Plant Head / Admin access is required.
        </p>

        <NavLink
          to="/"
          className="primary-button"
        >
          Back to Dashboard
        </NavLink>

      </section>
    );
  }

  return <>{children}</>;
}


/* ============================================================
   ROUTES
============================================================ */

function RoutesView() {

  const routes = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          item.path !== "/"
      ),
    []
  );


  return (
    <Routes>

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />


      <Route
        element={
          <ProtectedLayout />
        }
      >

        <Route
          path="/"
          element={
            <DashboardPage />
          }
        />


        {routes.map(
          (item) => (

            <Route
              key={item.path}
              path={item.path}
              element={

                <AccessGuard
                  page={item.page}
                >

                  {item.path ===
                  "/md-commercial" ? (

                    <MDCommercialPage />

                  ) : item.path ===
                    "/leads" ? (

                    <LeadsPage />

                  ) : item.path ===
                    "/purchase-orders" ? (

                    <PurchaseOrdersPage />

                  ) : item.path ===
                    "/order-management" ? (

                    <OrderManagementPage />

                  ) : item.path ===
                    "/ppic" ? (

                    <PPICPage />

                  ) : item.path ===
                    "/production" ? (

                    <ProductionPage />

                  ) : item.path ===
                    "/reactors" ? (

                    <ReactorsPage />

                  ) : item.path ===
                    "/equipment" ? (

                    <EquipmentPage />

                  ) : item.path ===
                    "/stock" ? (

                    <StockManagementPage />

                  ) : item.path ===
                    "/supply-chain" ? (

                    <SupplyChainPage />

                  ) : item.path ===
                    "/coa" ? (

                    <COAPage />

                  ) : item.path ===
                    "/samples" ? (

                    <SamplesPage />

                  ) : item.path ===
                    "/quotes" ? (

                    <QuotesPage />

                  ) : (

                    <ModulePage
                      page={
                        item.page
                      }
                    />

                  )}

                </AccessGuard>

              }
            />

          )
        )}


        <Route
          path="/users"
          element={

            <AdminGuard>

              <UsersPage />

            </AdminGuard>

          }
        />

      </Route>


      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}


/* ============================================================
   APP
============================================================ */

export default function App() {
  return <RoutesView />;
}