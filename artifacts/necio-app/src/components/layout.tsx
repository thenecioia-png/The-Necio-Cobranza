import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, CalendarCheck, Users, LogOut, Loader2, UserCog, CreditCard, Menu, X, Receipt, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfflineBanner } from "@/components/offline-banner";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { TutorialButton } from "@/components/tutorial";

const ADMIN_ONLY = ["/dashboard", "/cobradores", "/billing", "/tracking"];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isDesktop = useIsDesktop();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe({ query: { retry: false } });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        queryClient.clear();
        window.location.href = "/";
      }
    }
  });

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/today", label: "Cobros de Hoy", icon: CalendarCheck },
    { href: "/clients", label: "Clientes", icon: Users },
    { href: "/expenses", label: "Gastos", icon: Receipt },
    ...(user?.role === "admin" ? [
      { href: "/cobradores", label: "Cobradores", icon: UserCog },
      { href: "/tracking", label: "Mapa GPS", icon: MapPin },
      { href: "/billing", label: "Facturación", icon: CreditCard },
    ] : []),
  ];

  return (
    <>
      {/* Mobile overlay */}
      {open && !isDesktop && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={onClose}
        />
      )}

      <aside
        aria-hidden={!isDesktop && !open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          isDesktop && "translate-x-0",
          !isDesktop && !open && "pointer-events-none"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-border/50">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="The Necio Cobranza"
              className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(225,29,72,0.5)]"
            />
            <div>
              <h1 className="font-display font-bold text-xl leading-none text-foreground">THE NECIO</h1>
              <p className="text-xs text-primary font-medium tracking-widest uppercase">Cobranza</p>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-6 text-sm text-muted-foreground flex-1 overflow-y-auto">
          <p className="px-2 mb-2 font-display uppercase tracking-wider text-xs font-semibold">Menú Principal</p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                  )}
                  <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-4 py-2">
          <div className="bg-background rounded-2xl p-4 border border-border shadow-inner mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-display mb-1">Usuario Activo</p>
            <p className="font-medium text-foreground truncate">{user?.name || "Cargando..."}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
              {user?.role && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                  {user.role}
                </span>
              )}
            </div>
          </div>

          <TutorialButton />

          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const { data, isLoading, isError } = useGetMe({
    query: {
      retry: false,
      refetchOnWindowFocus: false
    }
  });
  // Must be called before any conditional return — Rules of Hooks
  const { status } = useNetworkStatus();
  const isOfflineOrSyncing = status === "offline" || status === "syncing";

  useEffect(() => {
    if (!data) return;
    if (data.role === "cobrador" && ADMIN_ONLY.some(p => location.startsWith(p))) {
      setLocation("/today");
    }
  }, [data, location]);

  // Close sidebar on location change (mobile nav)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      setLocation("/");
    }
  }, [isLoading, isError, data]);

  if (isLoading || isError || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        {isLoading && (
          <>
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Loading"
              className="w-16 h-16 animate-pulse-subtle mb-6 drop-shadow-[0_0_15px_rgba(225,29,72,0.4)]"
            />
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <OfflineBanner />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar — only renders on small screens */}
      {!isDesktop && (
        <div className={cn(
          "fixed left-0 right-0 z-30 h-14 bg-card border-b border-border flex items-center px-4 gap-3 shadow-md transition-all duration-300",
          isOfflineOrSyncing ? "top-9" : "top-0"
        )}>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <img
            src={`${import.meta.env.BASE_URL}images/logo.png`}
            alt="Logo"
            className="w-7 h-7 object-contain drop-shadow-[0_0_5px_rgba(225,29,72,0.5)]"
          />
          <span className="font-display font-bold text-sm tracking-widest text-foreground uppercase">THE NECIO</span>
        </div>
      )}

      <main className={cn(
        "flex-1 min-h-screen overflow-x-hidden transition-all duration-300",
        isDesktop ? "ml-64" : isOfflineOrSyncing ? "pt-[92px]" : "pt-14"
      )}>
        {children}
      </main>
    </div>
  );
}
