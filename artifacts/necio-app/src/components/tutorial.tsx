import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "wouter";
import {
  ChevronRight, ChevronLeft, X, LayoutDashboard, Users, CreditCard,
  ClipboardList, Banknote, CheckCircle2, BookOpen, ArrowRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AUTH_PATHS = ["/", "/register", "/forgot-password", "/reset-password"];

const STORAGE_KEY = "necio_tutorial_done";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  tips: string[];
  color: string;
  path?: string;
  illustration: React.ReactNode;
}

const steps: Step[] = [
  {
    id: "bienvenida",
    icon: <Sparkles className="w-8 h-8" />,
    title: "¡Bienvenido a Necio!",
    subtitle: "Tu sistema de cobranza digital",
    description: "Este tutorial rápido te enseña a dominar la app en minutos. Puedes saltarlo y verlo de nuevo cuando quieras.",
    tips: [],
    color: "from-primary/30 to-primary/5",
    illustration: (
      <div className="flex flex-col items-center gap-3">
        <img src="/images/logo.png" className="w-20 h-20 rounded-2xl shadow-lg" alt="Necio" />
        <p className="text-xs text-muted-foreground text-center">The Necio Cobranza</p>
      </div>
    ),
  },
  {
    id: "dashboard",
    icon: <LayoutDashboard className="w-8 h-8" />,
    title: "Dashboard",
    subtitle: "Tu panorama diario",
    description: "Aquí ves el resumen del negocio de un vistazo: cobros del día, cuotas pendientes, flujo de caja y el rendimiento de cada cobrador.",
    tips: [
      "Los números en rojo indican cuotas vencidas.",
      "La gráfica muestra el historial de pagos de los últimos meses.",
      "El ranking de cobradores te ayuda a identificar quién rinde más.",
    ],
    color: "from-violet-500/20 to-violet-500/5",
    path: "/dashboard",
    illustration: (
      <div className="w-full space-y-2">
        {[["Cobros hoy", "RD$12,500", "text-emerald-400"], ["Pendientes", "8 cuotas", "text-amber-400"], ["Cartera total", "RD$340,000", "text-blue-400"]].map(([l, v, c]) => (
          <div key={l} className="flex justify-between items-center bg-white/5 rounded-lg px-3 py-2">
            <span className="text-xs text-muted-foreground">{l}</span>
            <span className={cn("text-sm font-bold", c)}>{v}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "clientes",
    icon: <Users className="w-8 h-8" />,
    title: "Clientes",
    subtitle: "Administra tu cartera",
    description: "Registra a cada cliente con su información completa. La app calcula automáticamente su puntaje de riesgo según su historial de pagos.",
    tips: [
      "Toca '+' en la esquina superior para agregar un cliente nuevo.",
      "Puedes subir una foto del cliente para identificarlo fácilmente.",
      "Filtra por sector o ciudad para encontrar clientes rápido.",
      "Toca un cliente para ver todos sus préstamos y cuotas.",
    ],
    color: "from-blue-500/20 to-blue-500/5",
    path: "/clients",
    illustration: (
      <div className="w-full space-y-2">
        {[["María Pérez", "Santo Domingo", "🟢"], ["Juan García", "Santiago", "🟡"], ["Rosa Marte", "La Vega", "🔴"]].map(([n, s, r]) => (
          <div key={n} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{(n as string)[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{n}</p>
              <p className="text-[10px] text-muted-foreground">{s}</p>
            </div>
            <span className="text-sm">{r}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "prestamos",
    icon: <CreditCard className="w-8 h-8" />,
    title: "Préstamos",
    subtitle: "Crea y gestiona créditos",
    description: "Desde la ficha del cliente, crea un préstamo con el monto, la tasa de interés y la frecuencia de cobro. Las cuotas se generan solas.",
    tips: [
      "Frecuencias disponibles: diaria, semanal, quincenal o mensual.",
      "La app calcula el total a pagar con intereses automáticamente.",
      "Puedes liquidar un préstamo completo con un solo toque.",
      "El botón 'Abono' permite pagos anticipados o parciales.",
    ],
    color: "from-emerald-500/20 to-emerald-500/5",
    illustration: (
      <div className="w-full space-y-2">
        <div className="bg-white/5 rounded-lg p-3 space-y-1.5">
          {[["Monto", "RD$10,000"], ["Interés", "20%"], ["Frecuencia", "Semanal"], ["Total cuotas", "12"]].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-[11px] text-muted-foreground">{l}</span>
              <span className="text-[11px] font-bold text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>12 cuotas generadas automáticamente</span>
        </div>
      </div>
    ),
  },
  {
    id: "cobros",
    icon: <ClipboardList className="w-8 h-8" />,
    title: "Ruta del Día",
    subtitle: "Para cobradores en campo",
    description: "Cada mañana aparece la lista de cuotas a cobrar ese día. Cobra una por una o selecciona varias a la vez para registrar pagos en bloque.",
    tips: [
      "Toca 'Cobrar' en una cuota para registrar el pago.",
      "Puedes tomar una foto del recibo como comprobante.",
      "La app guarda tu ubicación GPS al momento de cobrar.",
      "Si no tienes internet, el cobro se guarda y se sube cuando reconnectes.",
      "Usa el modo selección (cuadrado arriba) para cobrar varias a la vez.",
    ],
    color: "from-amber-500/20 to-amber-500/5",
    path: "/today",
    illustration: (
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Carlos Rodríguez</p>
            <p className="text-[10px] text-muted-foreground">Cuota semanal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">RD$800</p>
            <div className="mt-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Cobrar
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
          <span className="text-amber-400">⚠️</span>
          <span>Funciona sin internet — sincroniza al reconectar</span>
        </div>
      </div>
    ),
  },
  {
    id: "abono",
    icon: <Banknote className="w-8 h-8" />,
    title: "Abonos",
    subtitle: "Pagos parciales y anticipados",
    description: "El botón 'Abono' permite que un cliente pague cualquier monto, aunque no alcance para la cuota completa. El sistema lo aplica inteligentemente.",
    tips: [
      "Si el monto cubre una cuota completa, la marca como pagada.",
      "Si sobra dinero después de una cuota, lo aplica como abono a la siguiente.",
      "Si es un pago parcial, lo guarda y al próximo abono descuenta lo ya pagado.",
      "La cuota con abono parcial aparece en azul con el monto pendiente.",
    ],
    color: "from-blue-500/20 to-blue-500/5",
    illustration: (
      <div className="w-full space-y-2">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-blue-400">Vista previa del abono</p>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Monto ingresado</span>
            <span className="font-bold text-foreground">RD$1,500</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">✅ Cuotas completas</span>
            <span className="font-bold text-emerald-400">1 cuota</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">💙 Abono parcial</span>
            <span className="font-bold text-blue-400">RD$500 → cuota #2</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "listo",
    icon: <CheckCircle2 className="w-8 h-8" />,
    title: "¡Ya estás listo!",
    subtitle: "Empieza a usar Necio",
    description: "Con esto dominas lo esencial. Recuerda que puedes ver este tutorial de nuevo en cualquier momento desde el menú de ayuda.",
    tips: [
      "Agrega tu primer cliente desde la sección 'Clientes'.",
      "Crea su préstamo y empieza a cobrar desde 'Ruta del Día'.",
      "¿Tienes dudas? Toca el botón '?' en cualquier pantalla.",
    ],
    color: "from-emerald-500/20 to-emerald-500/5",
    illustration: (
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <p className="text-xs text-muted-foreground text-center">Tutorial completado</p>
      </div>
    ),
  },
];

interface TutorialCtx {
  open: boolean;
  start: () => void;
  close: () => void;
}

const TutorialContext = createContext<TutorialCtx>({ open: false, start: () => {}, close: () => {} });

export function useTutorial() {
  return useContext(TutorialContext);
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pathname] = useLocation();

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done && !AUTH_PATHS.includes(pathname)) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const start = () => setOpen(true);
  const close = () => setOpen(false);

  return (
    <TutorialContext.Provider value={{ open, start, close }}>
      {children}
      {open && <TutorialOverlay onClose={close} />}
    </TutorialContext.Provider>
  );
}

function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      handleFinish();
    } else {
      const next = steps[step + 1];
      if (next.path) navigate(next.path);
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const prev = steps[step - 1];
      if (prev.path) navigate(prev.path);
      setStep(s => s - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className={cn("bg-gradient-to-br p-6 pb-5", current.color)}>
          <div className="flex items-start justify-between mb-4">
            <div className={cn(
              "p-3 rounded-2xl",
              step === 0 ? "bg-primary/20 text-primary" :
              step === steps.length - 1 ? "bg-emerald-500/20 text-emerald-400" :
              "bg-white/10 text-foreground"
            )}>
              {current.icon}
            </div>
            <button
              onClick={handleSkip}
              className="p-1.5 rounded-xl hover:bg-white/10 text-muted-foreground transition-colors"
              title="Cerrar tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl font-display font-bold text-foreground">{current.title}</h2>
          <p className="text-sm text-primary font-semibold mt-0.5">{current.subtitle}</p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{current.description}</p>
        </div>

        {/* Illustration */}
        <div className="px-6 py-4 border-b border-border/50">
          {current.illustration}
        </div>

        {/* Tips */}
        {current.tips.length > 0 && (
          <div className="px-6 py-4 space-y-2 max-h-40 overflow-y-auto border-b border-border/50">
            {current.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-snug">{tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          {/* Step dots */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => { setStep(i); if (steps[i].path) navigate(steps[i].path!); }}
                className={cn(
                  "rounded-full transition-all",
                  i === step ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-border hover:bg-border/60"
                )}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="p-2 rounded-xl border border-border hover:bg-white/5 text-muted-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleNext}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                isLast
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-primary hover:bg-primary/90 text-white"
              )}
            >
              {isLast ? "¡Empezar!" : "Siguiente"}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TutorialButton() {
  const { start } = useTutorial();
  return (
    <button
      onClick={start}
      title="Ver tutorial"
      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
    >
      <BookOpen className="w-4 h-4" />
      <span>Tutorial</span>
    </button>
  );
}
