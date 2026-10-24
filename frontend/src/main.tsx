import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import "./index.css";
import Advisor from "./pages/Advisor";
import Analytics from "./pages/Analytics";
import Compare from "./pages/Compare";
import Consent from "./pages/Consent";
import Demo from "./pages/Demo";
import Investigation from "./pages/Investigation";
import Landing from "./pages/Landing";
import MasterReport from "./pages/MasterReport";
import Onboarding from "./pages/Onboarding";
import Partners from "./pages/Partners";
import Report from "./pages/Report";
import Ringi from "./pages/Ringi";
import TermSheetPage from "./pages/TermSheetPage";
import Verified from "./pages/Verified";

const AuditField = lazy(() => import("./pages/AuditField"));
// Trust-backed procurement (frontend-only prototype), code-split so the existing app's bundle doesn't grow.
const TradeHub = lazy(() => import("./pages/trade/TradeHub"));
const Source = lazy(() => import("./pages/trade/Source"));
const SupplierPage = lazy(() => import("./pages/trade/SupplierPage"));
const PoolPage = lazy(() => import("./pages/trade/PoolPage"));
const NewRfq = lazy(() => import("./pages/trade/NewRfq"));
const Pools = lazy(() => import("./pages/trade/Lists").then((m) => ({ default: m.Pools })));
const Orders = lazy(() => import("./pages/trade/Lists").then((m) => ({ default: m.Orders })));
const OrderPage = lazy(() => import("./pages/trade/OrderPage"));
const PayPage = lazy(() => import("./pages/trade/PayPage"));
const SupplierConsole = lazy(() => import("./pages/trade/SupplierConsole"));
const Ops = lazy(() => import("./pages/trade/Ops"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="grid h-screen place-items-center text-sm text-muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/advisor/:smeId" element={<Advisor />} />
            <Route path="/partners/:smeId" element={<Partners />} />
            <Route path="/investigation/:id" element={<Investigation />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/compare/:smeId" element={<Compare />} />
            <Route path="/intelligence/:smeId" element={<Analytics />} />
            <Route path="/ringi/:id" element={<Ringi />} />
            <Route path="/consent/:token" element={<Consent />} />
            <Route path="/verified/:id" element={<Verified />} />
            <Route path="/termsheet/:id" element={<TermSheetPage />} />
            <Route path="/master-report/:smeId" element={<MasterReport />} />
            <Route path="/audit/:id/field" element={<AuditField />} />
            <Route path="/trade" element={<TradeHub />} />
            <Route path="/source" element={<Source />} />
            <Route path="/supplier/:id" element={<SupplierPage />} />
            <Route path="/rfq/new" element={<NewRfq />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/pool/:id" element={<PoolPage />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderPage />} />
            <Route path="/pay/:poId" element={<PayPage />} />
            <Route path="/s" element={<SupplierConsole />} />
            <Route path="/ops" element={<Ops />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
