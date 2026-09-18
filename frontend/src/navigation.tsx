import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  PackageSearch,
  Truck,
  Users,
  Wrench,
  Workflow,
  Factory,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  path: string;
  page: string;
  group: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", page: "Dashboard", group: "OVERVIEW", icon: LayoutDashboard },
  { label: "MD Commercial View", path: "/md-commercial", page: "MD Commercial View", group: "OVERVIEW", icon: BriefcaseBusiness },

  { label: "Leads", path: "/leads", page: "Leads", group: "COMMERCIAL", icon: Users },
  { label: "COA", path: "/coa", page: "COA", group: "COMMERCIAL", icon: FileCheck2 },
  { label: "Samples", path: "/samples", page: "Samples", group: "COMMERCIAL", icon: PackageSearch },
  { label: "Quotes", path: "/quotes", page: "Quotes", group: "COMMERCIAL", icon: FileText },

  { label: "Purchase Orders", path: "/purchase-orders", page: "Purchase Orders", group: "ORDERS", icon: ClipboardList },
  { label: "Order Management", path: "/order-management", page: "Order Management", group: "ORDERS", icon: Workflow },

  { label: "PPIC", path: "/ppic", page: "PPIC", group: "PLANT", icon: CalendarClock },
  { label: "Production", path: "/production", page: "Production", group: "PLANT", icon: Factory },
  { label: "Reactors", path: "/reactors", page: "Reactors", group: "PLANT", icon: FlaskConical },
  { label: "Equipment & Utilities", path: "/equipment", page: "Equipment & Utilities", group: "PLANT", icon: Wrench },

  { label: "Stock Management", path: "/stock", page: "Stock Management", group: "MATERIALS & LOGISTICS", icon: Boxes },
  { label: "Supply Chain", path: "/supply-chain", page: "Supply Chain", group: "MATERIALS & LOGISTICS", icon: Truck },
];

export const ROLE_NAMES = [
  "Plant Head / Admin",
  "Managing Director",
  "Sales & Marketing",
  "QC / QA",
  "PPIC Planner",
  "Production / Plant",
  "Stores & Supply Chain",
];

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  "Plant Head / Admin": "Full access across commercial, plant and logistics",
  "Managing Director": "Executive view of commercial pipeline plus plant and logistics oversight",
  "Sales & Marketing": "Leads, samples, quotes and the order book",
  "QC / QA": "COA, samples and batch release visibility",
  "PPIC Planner": "Production planning, orders and material availability",
  "Production / Plant": "Reactors, equipment and running batches",
  "Stores & Supply Chain": "Stock lots, procurement and dispatch",
};
