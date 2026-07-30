import { BarChart3, BookOpen, ExternalLink, Inbox, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const navigation = [
  { label: "Dashboard", to: "/admin", icon: BarChart3, end: true },
  { label: "Base de conhecimento", to: "/admin/faqs", icon: BookOpen, end: false },
  { label: "Sem resposta", to: "/admin/knowledge-gaps", icon: Inbox, end: false }
] as const;

const navigationClass =
  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors";

export function AdminHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <NavLink className="flex w-fit items-center gap-3" to="/admin">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">FAQ Intelligence</span>
            <span className="block text-xs text-slate-400">Painel administrativo</span>
          </span>
        </NavLink>

        <nav aria-label="Administração" className="flex flex-wrap items-center gap-1 sm:gap-2">
          {navigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              className={({ isActive }) =>
                `${navigationClass} ${
                  isActive
                    ? "bg-white text-slate-950"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
              end={end}
              key={to}
              to={to}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <a
            className={`${navigationClass} text-slate-300 hover:bg-white/10 hover:text-white`}
            href="/admin/queues/"
            rel="noreferrer"
            target="_blank"
          >
            Filas
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}
