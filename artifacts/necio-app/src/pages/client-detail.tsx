import { useParams, Link } from "wouter";
import { useGetClient } from "@workspace/api-client-react";
import { formatRD, formatDate, capitalize } from "@/lib/utils";
import { User, Phone, MapPin, CreditCard, Calendar, Plus, ArrowLeft, CheckCircle2, Clock } from "lucide-react";

export default function ClientDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  
  const { data: client, isLoading, isError } = useGetClient(id);

  if (isLoading) {
    return <div className="p-12 text-center text-muted-foreground">Cargando datos del cliente...</div>;
  }

  if (isError || !client) {
    return <div className="p-12 text-center text-destructive">Error al cargar cliente.</div>;
  }

  return (
    <div className="p-8 lg:p-12 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-xl mb-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
        <div className="flex gap-6 items-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-rose-900 flex items-center justify-center text-4xl text-white font-display shadow-lg shadow-primary/20">
            {client.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">{client.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {client.cedula && <span className="flex items-center gap-1.5"><User className="w-4 h-4"/> {client.cedula}</span>}
              {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4"/> {client.phone}</span>}
            </div>
            {client.address && (
              <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0"/> {client.address}
              </div>
            )}
          </div>
        </div>
        
        <Link href="/loans/new" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(225,29,72,0.3)] flex items-center gap-2 whitespace-nowrap">
          <Plus className="w-5 h-5" /> Nuevo Préstamo
        </Link>
      </div>

      <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-3">
        <CreditCard className="w-6 h-6 text-primary" /> Historial de Préstamos
      </h2>

      {client.loans.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border border-dashed rounded-3xl">
          <p className="text-muted-foreground mb-4">Este cliente no tiene préstamos registrados.</p>
          <Link href="/loans/new" className="text-primary font-bold hover:underline">Registrar el primer préstamo</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {client.loans.map(loan => {
            const paidCount = loan.installments.filter(i => i.status === 'paid').length;
            const progress = (paidCount / loan.installmentsCount) * 100;
            const isCompleted = progress === 100;

            return (
              <div key={loan.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
                <div className="p-6 border-b border-border bg-secondary/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-display font-bold">{formatRD(loan.amount)}</h3>
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${isCompleted ? 'bg-emerald-500/20 text-emerald-500' : 'bg-primary/20 text-primary'}`}>
                        {isCompleted ? 'Completado' : 'Activo'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-3">
                      <span>Interés: {loan.interestRate}%</span>
                      <span>•</span>
                      <span>Total: {formatRD(loan.totalAmount)}</span>
                    </p>
                  </div>
                  
                  <div className="text-right w-full md:w-auto">
                    <p className="text-sm text-muted-foreground mb-1"><Calendar className="w-4 h-4 inline mr-1" /> Inicio: {formatDate(loan.startDate)}</p>
                    <p className="text-sm font-medium capitalize">Frecuencia: {loan.frequency}</p>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span>Progreso: {paidCount} de {loan.installmentsCount} cuotas</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3 mb-6 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`} 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {loan.installments.map((inst, i) => (
                      <div key={inst.id} className={`p-3 rounded-xl border text-center relative overflow-hidden ${
                        inst.status === 'paid' 
                          ? 'border-emerald-500/30 bg-emerald-500/5' 
                          : inst.status === 'late'
                            ? 'border-amber-500/50 bg-amber-500/10'
                            : 'border-border bg-background'
                      }`}>
                        <p className="text-xs text-muted-foreground mb-1">Cuota {i + 1}</p>
                        <p className={`font-bold font-display ${inst.status === 'paid' ? 'text-emerald-500' : 'text-foreground'}`}>
                          {formatRD(inst.amount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDate(inst.dueDate)}</p>
                        
                        {inst.status === 'paid' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 absolute top-2 right-2 opacity-50" />
                        )}
                        {inst.status === 'late' && (
                          <Clock className="w-4 h-4 text-amber-500 absolute top-2 right-2 opacity-50" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
