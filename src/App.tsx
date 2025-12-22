import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RentalProvider } from "@/hooks/useRental";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Rentals from "./pages/Rentals";
import Customers from "./pages/Customers";
import Inventory from "./pages/Inventory";
import Repairs from "./pages/Repairs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <RentalProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rentals" element={<Rentals />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/repairs" element={<Repairs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </RentalProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
