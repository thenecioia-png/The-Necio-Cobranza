import { useGetDashboardStats } from "@workspace/api-client-react";
import { formatRD } from "@/lib/utils";
import { Users, Banknote, Clock, Target, ArrowRight, TrendingUp, AlertTriangle, DollarSign, Percent } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse space-y-8 w-full max-w-6xl">
          <div className="h-10 bg-card rounded w-1/4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-28 bg-card rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const collectionRate = stats.todayTotal > 0
    ? Math.round((stats.todayCollected / stats.todayTotal) * 100)
    : 0;

  const topKpis = [
    {
      title: "Recaudado Hoy",
      value: formatRD(stats.todayCollected),
      subtitle: `${collectionRate}% de ${formatRD(stats.todayTotal)}`,
      icon: Banknote,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Pendiente Hoy",
      value: formatRD(stats.todayPending),
      subtitle: "Falta por cobrar hoy",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      title: "Dinero en la Calle",
      value: formatRD(stats.moneyOnStreet),
      subtitle: "Total por recuperar",
      icon: DollarSign,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    },
    {
      title: "% de Mora",
      value: `${stats.delinquencyRate}%`,
      subtitle: stats.delinquencyRate > 20 ? "⚠️ Nivel alto" : "Bajo control",
      icon: Percent,
      color: stats.delinquencyRate > 20 ? "text-red-500" : "text-emerald-500",
      bg: stats.delinquencyRate > 20 ? "bg-red-500/10" : "bg-emerald-500/10",
      border: stats.delinquencyRate > 20 ? "border-red-500/20" : "border-emerald-500/20",
    },
  ];

  const bottomKpis = [
    {
      title: "Total Prestado",
      value: formatRD(stats.totalLent),
      subtitle: "Capital colocado",
      icon: TrendingUp,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
    },
    {
      title: "Total Cobrado",
      value: formatRD(stats.totalCollected),
      subtitle: "Recuperado históricamente",
      icon: Banknote,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    {
      title: "Préstamos Activos",
      value: stats.activeLoans.toString(),
      subtitle: "Generando intereses",
      icon: Target,
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      title: "Clientes",
      value: stats.totalClients.toString(),
      subtitle: `${stats.delinquentClients} en mora`,
      icon: Users,
      color: stats.delinquentClients > 0 ? "text-amber-500" : "text-blue-400",
      bg: stats.delinquentClients > 0 ? "bg-amber-500/10" : "bg-blue-400/10",
      border: stats.delinquentClients > 0 ? "border-amber-500/20" : "border-blue-400/20",
    },
  ];

  const allKpis = [...topKpis, ...bottomKpis];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Visión General</h1>
        <p className="text-muted-foreground mt-1">Resumen financiero en tiempo real.</p>
      </div>

      {stats.delinquencyRate > 20 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4"
        >
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-400">
            <span className="font-bold">Alerta de mora:</span> El {stats.delinquencyRate}% de cuotas pendientes están atrasadas. Hay {stats.delinquentClients} cliente(s) morosos.
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {allKpis.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, duration: 0.4 }}
            className={`bg-card rounded-2xl p-5 border ${card.border} shadow-lg relative overflow-hidden group`}
          >
            <div className={`absolute top-0 right-0 p-3 opacity-10 transform translate-x-3 -translate-y-3 group-hover:scale-110 transition-transform duration-500 ${card.color}`}>
              <card.icon className="w-16 h-16" />
            </div>
            <div className="relative z-10">
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight mb-1">{card.title}</p>
              <p className="text-2xl font-display font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-gradient-to-br from-primary/20 via-card to-background border border-primary/20 rounded-3xl p-7 shadow-xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs text-primary font-bold uppercase tracking-widest">En vivo</span>
            </div>
            <h2 className="text-2xl font-display font-bold mb-1">Ruta de Cobros de Hoy</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {stats.todayPending > 0
                ? `Hay ${formatRD(stats.todayPending)} por cobrar. ¡A trabajar!`
                : "¡Excelente! Todo cobrado por hoy."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/today" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] hover:-translate-y-0.5">
              Ir a Cobros <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/clients" className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-foreground px-6 py-3.5 rounded-xl font-medium transition-all border border-border hover:-translate-y-0.5">
              Ver Clientes
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-3xl p-7 shadow-xl flex flex-col justify-between"
        >
          <div>
            <h2 className="text-xl font-display font-bold mb-1">Acciones Rápidas</h2>
            <p className="text-muted-foreground text-sm mb-5">Gestiona clientes y préstamos.</p>
          </div>
          <div className="space-y-3">
            <Link href="/clients/new" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-3 font-medium text-sm transition-all hover:-translate-y-0.5 group">
              <span>Nuevo Cliente</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
            <Link href="/loans/new" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-3 font-medium text-sm transition-all hover:-translate-y-0.5 group">
              <span>Nuevo Préstamo</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
            <Link href="/clients" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-3 font-medium text-sm transition-all hover:-translate-y-0.5 group">
              <span>Ver Todos los Clientes</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
