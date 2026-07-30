import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { rememberCsrfToken, requestEmpty, requestJson } from "../../shared/api/http-client.js";

const sessionSchema = z.object({
  admin: z.object({
    id: z.string(),
    email: z.string().email(),
    displayName: z.string()
  }),
  csrfToken: z.string()
});

export function useSession() {
  return useQuery({
    queryKey: ["admin-session"],
    queryFn: async () => {
      const session = await requestJson("/api/v1/auth/session", {
        method: "GET",
        schema: sessionSchema
      });
      rememberCsrfToken(session.csrfToken);
      return session;
    },
    retry: false
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      requestEmpty("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-session"] })
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestEmpty("/api/v1/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.removeQueries({ queryKey: ["admin-session"] })
  });
}
