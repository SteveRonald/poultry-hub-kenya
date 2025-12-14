
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { AdminProvider } from "./contexts/AdminContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Checkout from "./pages/Checkout";
import VendorDashboard from "./pages/VendorDashboard";
import VendorInbox from "./pages/VendorInbox";
import CustomerInbox from "./pages/CustomerInbox";
import AdminDashboard from "./pages/AdminDashboard";
import Training from "./pages/Training";
import Blog from "./pages/Blog";
import Contact from "./pages/Contact";
import MarketInsights from "./pages/MarketInsights";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLogin from "./pages/AdminLogin";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import Chatbot from "./components/Chatbot";
import ChatPage from "./pages/ChatPage";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <CartProvider>
              <ChatProvider>
                <AdminProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/product/:id" element={<ProductDetails />} />
                      <Route path="/chat/:productId" element={
                        <ProtectedRoute>
                          <ChatPage />
                        </ProtectedRoute>
                      } />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/market-insights" element={<MarketInsights />} />
                      <Route path="/training" element={<Training />} />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/dashboard" element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/vendor-dashboard" element={
                        <ProtectedRoute allowedRoles={['vendor', 'admin']}>
                          <VendorDashboard />
                        </ProtectedRoute>
                      } />
                      <Route path="/vendor/inbox" element={
                        <ProtectedRoute allowedRoles={['vendor', 'admin']}>
                          <VendorInbox />
                        </ProtectedRoute>
                      } />
                      <Route path="/inbox" element={
                        <ProtectedRoute>
                          <CustomerInbox />
                        </ProtectedRoute>
                      } />
                      <Route path="/admin-dashboard" element={
                        <AdminProtectedRoute>
                          <AdminDashboard />
                        </AdminProtectedRoute>
                      } />
                      <Route path="/control_90E-panel" element={<AdminLogin />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <Chatbot />
                  </BrowserRouter>
                </AdminProvider>
              </ChatProvider>
            </CartProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
