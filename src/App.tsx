import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RentalProvider } from "@/hooks/useRental";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Rentals from "./pages/Rentals";
import Customers from "./pages/Customers";
import Inventory from "./pages/Inventory";
import Repairs from "./pages/Repairs";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentError from "./pages/PaymentError";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RentalProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/rentals" element={<Rentals />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/repairs" element={<Repairs />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/payment-error" element={<PaymentError />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          </BrowserRouter>
        </RentalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
