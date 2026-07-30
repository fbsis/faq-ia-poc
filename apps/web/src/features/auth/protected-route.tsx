import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminHeader } from "../admin/admin-header.js";
import { useSession } from "./use-session.js";

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <main className="grid min-h-screen place-items-center" aria-live="polite">
        Verificando acesso…
      </main>
    );
  }
  if (session.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <>
      <AdminHeader />
      <Outlet />
    </>
  );
}
