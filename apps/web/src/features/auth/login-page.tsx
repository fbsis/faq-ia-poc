import { Button, Input } from "@faq/ui";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLogin } from "./use-session.js";

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (login.isSuccess) {
      const from = (location.state as { from?: string } | null)?.from ?? "/admin";
      void navigate(from, { replace: true });
    }
  }, [location.state, login.isSuccess, navigate]);

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <form className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft" onSubmit={submit}>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-teal-700">
          FAQ Intelligence
        </p>
        <h1 className="mb-2 text-3xl font-bold">Acesso administrativo</h1>
        <p className="mb-8 text-slate-600">Entre para administrar a base de conhecimento.</p>
        <label className="mb-5 block">
          <span className="mb-2 block text-sm font-medium">E-mail</span>
          <Input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-2 block text-sm font-medium">Senha</span>
          <Input
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {login.isError ? (
          <p className="mb-4 text-sm text-red-700" role="alert">
            E-mail ou senha inválidos.
          </p>
        ) : null}
        <Button className="w-full" disabled={login.isPending} type="submit">
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
