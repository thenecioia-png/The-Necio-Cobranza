import { useGetDashboardStats } from "@workspace/api-client-react";
import { formatRD } from "@/lib/utils";
import { Users, Banknote, Clock, Target, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse space-y-8 w-full max-w-5xl">
          <div className="h-10 bg-card rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-card rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Recaudado Hoy",
      value: formatRD(stats.todayCollected),
      subtitle: `De ${formatRD(stats.todayTotal)} total esperado`,
      icon: Banknote,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20"
    },
    {
      title: "Pendiente Hoy",
      value: formatRD(stats.todayPending),
      subtitle: "Falta por cobrar",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    },
    {
      title: "Préstamos Activos",
      value: stats.activeLoans.toString(),
      subtitle: "Generando intereses",
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20"
    },
    {
      title: "Total Clientes",
      value: stats.totalClients.toString(),
      subtitle: "Registrados en sistema",
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    }
  ];

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-foreground">Visión General</h1>
        <p className="text-muted-foreground mt-1">Resumen del rendimiento de cobros.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.5 }}
            className={`bg-card rounded-2xl p-6 border ${card.border} shadow-lg relative overflow-hidden group`}
          >
            <div className={`absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500 ${card.color}`}>
              <card.icon className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{card.title}</h3>
              <p className="text-3xl font-display font-bold text-foreground mt-2 mb-1">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-card to-background border border-border rounded-3xl p-8 shadow-xl flex flex-col justify-between"
        >
          <div>
            <h2 className="text-2xl font-display font-bold mb-2">Cobros del Día</h2>
            <p className="text-muted-foreground mb-6">Administra las cuotas que vencen en el día de hoy.</p>
          </div>
          <Link href="/today" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-4 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] hover:-translate-y-1 w-max">
            Ir a Rutas de Cobro <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-3xl p-8 shadow-xl flex flex-col justify-between"
        >
          <div>
            <h2 className="text-2xl font-display font-bold mb-2">Gestión de Clientes</h2>
            <p className="text-muted-foreground mb-6">Añade nuevos clientes y registra nuevos préstamos en el sistema.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/clients/new" className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground border border-border px-6 py-4 rounded-xl font-bold transition-all hover:-translate-y-1">
              Nuevo Cliente
            </Link>
            <Link href="/clients" className="inline-flex items-center justify-center bg-transparent hover:bg-white/5 text-foreground px-6 py-4 rounded-xl font-bold transition-all">
              Ver Todos
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
