import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, CalendarCheck, Users, LogOut, Loader2, PlusCircle, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

function Sidebar() {
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
    ...(user?.role === "admin" ? [{ href: "/cobradores", label: "Cobradores", icon: UserCog }] : []),
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col shadow-2xl">
      <div className="p-6 flex items-center gap-3 border-b border-border/50">
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

      <div className="px-4 py-6 text-sm text-muted-foreground">
        <p className="px-2 mb-2 font-display uppercase tracking-wider text-xs font-semibold">Menú Principal</p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
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

      <div className="px-4 py-2 mt-auto">
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
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useGetMe({ 
    query: { 
      retry: false,
      refetchOnWindowFocus: false
    } 
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <img 
          src={`${import.meta.env.BASE_URL}images/logo.png`} 
          alt="Loading" 
          className="w-16 h-16 animate-pulse-subtle mb-6 drop-shadow-[0_0_15px_rgba(225,29,72,0.4)]"
        />
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
