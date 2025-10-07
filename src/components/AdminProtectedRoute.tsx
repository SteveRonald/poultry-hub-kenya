import React from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const sessionToken = localStorage.getItem("admin_session_token");
  const adminInfo = localStorage.getItem("admin_info");
  const isAdmin = adminInfo && JSON.parse(adminInfo).role === "admin";

  if (!sessionToken || !isAdmin) {
    toast.error("Access denied. Admin privileges required.");
    return <Navigate to="/admin-login" replace />;
  }
  return <>{children}</>;
};

export default AdminProtectedRoute; 