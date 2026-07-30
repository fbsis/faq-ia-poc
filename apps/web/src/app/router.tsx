import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/login-page.js";
import { ProtectedRoute } from "../features/auth/protected-route.js";
import { ChatPage } from "../features/chat/chat-page.js";

function AdminPlaceholder() {
  return <main className="grid min-h-screen place-items-center">Área administrativa</main>;
}

export const router = createBrowserRouter([
  { path: "/", element: <ChatPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [{ path: "/admin", element: <AdminPlaceholder /> }]
  }
]);
