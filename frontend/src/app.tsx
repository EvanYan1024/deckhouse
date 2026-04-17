import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/layout";
import { DashboardPage } from "@/pages/dashboard";
import { CreateStackPage } from "@/pages/create-stack";
import { ComposePage } from "@/pages/compose";
import { SettingsPage } from "@/pages/settings";
import { ConsolePage } from "@/pages/console";
import { LoginPage } from "@/pages/login";
import { SetupPage } from "@/pages/setup";

export function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/compose" element={<CreateStackPage />} />
            <Route path="/compose/:stackName" element={<ComposePage />} />
            <Route path="/compose/:stackName/:endpoint" element={<ComposePage />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </TooltipProvider>
  );
}
