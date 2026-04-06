import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatRD } from "@/lib/utils";
import { Plus, Pencil, Trash2, Fuel, UtensilsCrossed, Droplets, Wrench, Phone, Hammer, MoreHorizontal, Receipt } from "lucide-react";

const API_BASE = "/api";

const CATEGORIES = [
  { value: "gasolina", label: "Gasolina", icon: Fuel, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  { value: "comida", label: "Comida", icon: UtensilsCrossed, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  { value: "agua", label: "Agua", icon: Droplets, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
  { value: "reparacion_moto", label: "Reparación Moto", icon: Wrench, color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
  { value: "reparacion_vehiculo", label: "Reparación Vehículo", icon: Wrench, color: "text-rose-400", bg: "bg-rose-400/10 border-rose-400/20" },
  { value: "comunicacion", label: "Comunicación", icon: Phone, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  { value: "herramientas", label: "Herramientas", icon: Hammer, color: "text-teal-400", bg: "bg-teal-400/10 border-teal-400/20" },
  { value: "otro", label: "Otro", icon: MoreHorizontal, color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" },
] as const;

type CategoryValue = typeof CATEGORIES[number]["value"];

interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

interface Summary {
  byCategory: Record<string, number>;
  total: number;
  count: number;
}

function getCat(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function Expenses() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const [filterCategory, setFilterCategory] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ category: "gasolina", description: "", amount: "", date: todayStr(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (filterCategory !== "all") params.set("category", filterCategory);
    try {
      const [expRes, sumRes] = await Promise.all([
        fetch(`${API_BASE}/expenses?${params}`, { credentials: "include" }),
        fetch(`${API_BASE}/expenses/summary?from=${from}&to=${to}`, { credentials: "include" }),
      ]);
      if (expRes.ok) setExpenses(await expRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch {}
    setLoading(false);
  }, [from, to, filterCategory]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ category: "gasolina", description: "", amount: "", date: todayStr(), notes: "" });
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({ category: e.category, description: e.description, amount: String(e.amount), date: e.date, notes: e.notes ?? "" });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.description.trim() || !form.amount || !form.date) {
      toast({ title: "Campos requeridos", description: "Completa descripción, monto y fecha.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = { category: form.category, description: form.description.trim(), amount, date: form.date, notes: form.notes.trim() || undefined };
      const url = editing ? `${API_BASE}/expenses/${editing.id}` : `${API_BASE}/expenses`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: editing ? "Gasto actualizado" : "Gasto registrado", description: editing ? "El gasto fue actualizado." : "El gasto fue registrado correctamente." });
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`${API_BASE}/expenses/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Gasto eliminado" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDeleting(null);
  }

  const totalByCategory = summary?.byCategory ?? {};
  const grandTotal = summary?.total ?? 0;

  return (
    <>
    <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Gastos
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Registra y controla los gastos de tu operación</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar Gasto</span>
            <span className="sm:hidden">Agregar</span>
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Categoría</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        {filterCategory === "all" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.filter(c => (totalByCategory[c.value] ?? 0) > 0).map(cat => {
              const Icon = cat.icon;
              const amt = totalByCategory[cat.value] ?? 0;
              return (
                <Card key={cat.value} className={`border ${cat.bg}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-background/50`}>
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{cat.label}</p>
                      <p className="text-sm font-semibold">{formatRD(amt)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {Object.keys(totalByCategory).length === 0 && !loading && (
              <div className="col-span-4 text-center py-4 text-muted-foreground text-sm">Sin gastos en el período</div>
            )}
          </div>
        )}

        {/* Grand total banner */}
        {grandTotal > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-5 py-3">
            <span className="text-sm font-medium text-muted-foreground">Total del período</span>
            <span className="text-lg font-bold text-primary">{formatRD(grandTotal)}</span>
          </div>
        )}

        {/* Expenses list */}
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Cargando gastos...</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Sin gastos registrados</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Haz clic en "Agregar Gasto" para comenzar</p>
            </div>
          ) : (
            expenses.map(expense => {
              const cat = getCat(expense.category);
              const Icon = cat.icon;
              return (
                <div key={expense.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${cat.bg}`}>
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="font-medium text-sm truncate">{expense.description}</p>
                      <span className={`text-xs ${cat.color} hidden sm:inline`}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{new Date(expense.date + "T12:00:00").toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })}</p>
                      {expense.notes && <span className="text-xs text-muted-foreground/60 truncate hidden sm:inline">· {expense.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-sm">{formatRD(expense.amount)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(expense.id)}
                        disabled={deleting === expense.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    return (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${c.color}`} />
                          {c.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej: Gasolina para la ruta del norte"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Monto (RD$) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notas <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea
                placeholder="Detalles adicionales..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editing ? "Guardar Cambios" : "Registrar Gasto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
