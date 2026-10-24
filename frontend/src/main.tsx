import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n";
import "./index.css";
import Compare from "./pages/Compare";
import Consent from "./pages/Consent";
import Demo from "./pages/Demo";
import Investigation from "./pages/Investigation";
import Landing from "./pages/Landing";
import Onboarding from "./pages/Onboarding";
import Partners from "./pages/Partners";
import Report from "./pages/Report";
import Ringi from "./pages/Ringi";
import Verified from "./pages/Verified";

const AuditField = lazy(() => import("./pages/AuditField"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/partners/:smeId" element={<Partners />} />
            <Route path="/investigation/:id" element={<Investigation />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/compare/:smeId" element={<Compare />} />
            <Route path="/ringi/:id" element={<Ringi />} />
            <Route path="/consent/:token" element={<Consent />} />
            <Route path="/verified/:id" element={<Verified />} />
            <Route path="/audit/:id/field" element={<AuditField />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
