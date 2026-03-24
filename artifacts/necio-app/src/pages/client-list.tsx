import { useState } from "react";
import { Link } from "wouter";
import { useGetClients } from "@workspace/api-client-react";
import { Users, Phone, MapPin, Search, Plus, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";

export default function ClientList() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: clients, isLoading } = useGetClients();

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-8">
          <div className="h-10 bg-card rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 bg-card rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  const filtered = clients?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cedula?.includes(searchTerm)
  ) || [];

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" /> Clientes
          </h1>
          <p className="text-muted-foreground mt-1">Directorio completo de clientes en el sistema.</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-4">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o cédula..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <Link href="/clients/new" className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-lg flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Nuevo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((client, idx) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(idx * 0.05, 0.5) }}
            className="bg-card border border-border hover:border-primary/50 rounded-2xl p-6 shadow-lg transition-all hover:shadow-xl hover:-translate-y-1 group"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold font-display text-foreground group-hover:text-primary transition-colors line-clamp-1">{client.name}</h3>
                {client.cedula && <p className="text-xs text-muted-foreground mt-1 font-mono">{client.cedula}</p>}
              </div>
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold font-display">
                {client.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {client.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" /> {client.phone}
                </div>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" /> <span className="line-clamp-2">{client.address}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Registrado: {formatDate(client.createdAt)}</span>
              <Link href={`/clients/${client.id}`} className="text-primary hover:text-white flex items-center gap-1 text-sm font-bold transition-colors">
                Ver Detalle <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        ))}
        
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No se encontraron clientes.
          </div>
        )}
      </div>
    </div>
  );
}
