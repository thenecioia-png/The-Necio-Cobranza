import { useEffect, useState } from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { formatRD } from "@/lib/utils";
import { Users, Banknote, Clock, Target, ArrowRight, TrendingUp, AlertTriangle, DollarSign, Percent, BarChart2, PieChart as PieIcon } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const API_BASE = "/api";

type CashFlowDay = { date: string; collected: number; expected: number };
type TopCobrador = { id: number; name: string; collected: number; pending: number; total: number };
type PaymentMethod = { name: string; value: number; emoji: string };

const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6"];

function formatShortDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("es-DO", { weekday: "short", day: "numeric" });
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const [cashFlow, setCashFlow] = useState<CashFlowDay[]>([]);
  const [topCobradores, setTopCobradores] = useState<TopCobrador[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/cash-flow`, { credentials: "include" })
      .then(r => r.json()).then(setCashFlow).catch(() => {});
    fetch(`${API_BASE}/dashboard/top-cobradores`, { credentials: "include" })
      .then(r => r.json()).then(setTopCobradores).catch(() => {});
    fetch(`${API_BASE}/dashboard/payment-methods`, { credentials: "include" })
      .then(r => r.json()).then(setPaymentMethods).catch(() => {});
  }, []);

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

  const totalPaymentMethods = paymentMethods.reduce((s, m) => s + m.value, 0);

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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {topKpis.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.4 }}
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
              <p className="text-xl font-display font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Cash Flow Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-display font-bold">Flujo de Caja — 7 Días</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Cobrado vs. esperado por día</p>
          {cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={cashFlow} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(val: number, name: string) => [formatRD(val), name === "collected" ? "Cobrado" : "Esperado"]}
                  labelFormatter={formatShortDate}
                />
                <Area type="monotone" dataKey="expected" stroke="#3b82f6" strokeWidth={2} fill="url(#colorExpected)" name="expected" strokeDasharray="4 2" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fill="url(#colorCollected)" name="collected" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Cargando datos...</div>
          )}
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-0.5 bg-emerald-500"></div> Cobrado
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-0.5 bg-blue-500" style={{ borderTop: "2px dashed #3b82f6" }}></div> Esperado
            </div>
          </div>
        </motion.div>

        {/* Payment Method Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-3xl p-6 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-1">
            <PieIcon className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-display font-bold">Métodos de Pago</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Total cobrado por método</p>
          {totalPaymentMethods > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={paymentMethods.filter(m => m.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {paymentMethods.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                    formatter={(val: number) => [formatRD(val)]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-1">
                {paymentMethods.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></div>
                      <span className="text-muted-foreground">{m.emoji} {m.name}</span>
                    </div>
                    <span className="font-semibold text-xs">{totalPaymentMethods > 0 ? Math.round((m.value / totalPaymentMethods) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">Sin datos aún</div>
          )}
        </motion.div>
      </div>

      {/* Bottom row: Top Cobradores + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Cobradores */}
        {topCobradores.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-lg"
          >
            <h2 className="text-lg font-display font-bold mb-1">Ranking de Cobradores</h2>
            <p className="text-xs text-muted-foreground mb-5">Desempeño de hoy</p>
            <div className="space-y-3">
              {topCobradores.slice(0, 5).map((cob, i) => {
                const pct = cob.total > 0 ? Math.round((cob.collected / cob.total) * 100) : 0;
                return (
                  <div key={cob.id} className="flex items-center gap-3">
                    <span className={`text-lg font-display font-bold w-6 shrink-0 ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold truncate">{cob.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{formatRD(cob.collected)} / {formatRD(cob.total)}</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 shrink-0 w-10 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Quick actions + Route CTA */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="bg-gradient-to-br from-primary/20 via-card to-background border border-primary/20 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-primary font-bold uppercase tracking-widest">En vivo</span>
              </div>
              <h2 className="text-xl font-display font-bold mb-1">Ruta de Hoy</h2>
              <p className="text-muted-foreground text-sm">
                {stats.todayPending > 0
                  ? `${formatRD(stats.todayPending)} por cobrar.`
                  : "¡Todo cobrado!"}
              </p>
            </div>
            <Link href="/today" className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:-translate-y-0.5">
              Ir a Cobros <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-xl">
            <h2 className="text-base font-display font-bold mb-4">Acciones Rápidas</h2>
            <div className="space-y-2.5">
              <Link href="/clients/new" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-2.5 font-medium text-sm transition-all hover:-translate-y-0.5 group">
                <span>Nuevo Cliente</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link href="/loans/new" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-2.5 font-medium text-sm transition-all hover:-translate-y-0.5 group">
                <span>Nuevo Préstamo</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link href="/clients" className="flex items-center justify-between w-full bg-background hover:bg-white/5 border border-border rounded-xl px-4 py-2.5 font-medium text-sm transition-all hover:-translate-y-0.5 group">
                <span>Ver Clientes</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
