import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RentalProvider } from "@/hooks/useRental";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleProvider } from "@/hooks/useRole";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionManager } from "@/components/SessionManager";
import { AppLayout } from "@/components/AppLayout";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Rentals = lazy(() => import("./pages/Rentals"));
const Customers = lazy(() => import("./pages/Customers"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Repairs = lazy(() => import("./pages/Repairs"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentError = lazy(() => import("./pages/PaymentError"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const Invoices = lazy(() => import("./pages/Invoices"));
const POS = lazy(() => import("./pages/POS"));
const CellStation = lazy(() => import("./pages/CellStation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));

const queryClient = new QueryClient();

// Minimal fallback for route-level suspense
const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RoleProvider>
          <RentalProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Install page - accessible without auth */}
                <Route path="/install" element={
                  <Suspense fallback={<PageFallback />}>
                    <Install />
                  </Suspense>
                } />
                
                {/* Protected routes */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <SessionManager />
                    <AppLayout>
                      <Suspense fallback={<PageFallback />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/rentals" element={<Rentals />} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/inventory" element={<Inventory />} />
                          <Route path="/repairs" element={<Repairs />} />
                          <Route path="/users" element={<UserManagement />} />
                          <Route path="/payments" element={<PaymentHistory />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/pos" element={<POS />} />
                          <Route path="/cellstation" element={<CellStation />} />
                          
                          <Route path="/payment-success" element={<PaymentSuccess />} />
                          <Route path="/payment-error" element={<PaymentError />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                } />
              </Routes>
            </BrowserRouter>
          </RentalProvider>
        </RoleProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
