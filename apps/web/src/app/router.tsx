import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/login-page.js";
import { ProtectedRoute } from "../features/auth/protected-route.js";
import { ChatPage } from "../features/chat/chat-page.js";

export const router = createBrowserRouter([
  { path: "/", element: <ChatPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/admin",
        lazy: async () => {
          const { DashboardPage } = await import("../features/dashboard/dashboard-page.js");
          return { Component: DashboardPage };
        }
      },
      {
        path: "/admin/faqs",
        lazy: async () => {
          const { FaqAdminPage } = await import("../features/faq-admin/faq-admin-page.js");
          return { Component: FaqAdminPage };
        }
      },
      {
        path: "/admin/knowledge-gaps",
        lazy: async () => {
          const { KnowledgeGapAdminPage } =
            await import("../features/knowledge-gap-admin/knowledge-gap-admin-page.js");
          return { Component: KnowledgeGapAdminPage };
        }
      }
    ]
  }
]);
