import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import FieldVisits from "@/pages/FieldVisits";
import VisitDetail from "@/pages/VisitDetail";
import AddVisit from "@/pages/AddVisit";
import AttendancePage from "@/pages/AttendancePage";
import Employees from "@/pages/Employees";
import EmployeeForm from "@/pages/EmployeeForm";
import Payroll from "@/pages/Payroll";
import Ledger from "@/pages/Ledger";
import Expenses from "@/pages/Expenses";
import Profile from "@/pages/Profile";
import CompanySettings from "@/pages/CompanySettings";
import "@/App.css";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Layout /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="visits" element={<FieldVisits />} />
            <Route path="visits/new" element={<AddVisit />} />
            <Route path="visits/:id" element={<VisitDetail />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="employees" element={<Protected roles={["admin","manager"]}><Employees /></Protected>} />
            <Route path="employees/new" element={<Protected roles={["admin"]}><EmployeeForm /></Protected>} />
            <Route path="employees/:id" element={<Protected roles={["admin","manager"]}><EmployeeForm /></Protected>} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="expenses" element={<Protected roles={["admin","manager"]}><Expenses /></Protected>} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Protected roles={["admin"]}><CompanySettings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
