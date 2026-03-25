import { useState, useEffect } from "react";
import { X, FileText, Shield, CheckCircle2, Loader2, Lock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "./signature-pad";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

interface ContractModalProps {
  loanId: number;
  clientName: string;
  onClose: () => void;
}

interface Contract {
  id: number;
  loanId: number;
  contractHtml: string | null;
  signatureBase64: string | null;
  signedAt: string | null;
  signerName: string | null;
}

export function ContractModal({ loanId, clientName, onClose }: ContractModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"loading" | "preview" | "signing" | "done">("loading");
  const [contract, setContract] = useState<Contract | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    setStep("loading");
    try {
      const res = await fetch(`${API_BASE}/contracts/generate/${loanId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error al generar contrato");
      const data = await res.json();
      setContract(data);
      if (data.signedAt) {
        setStep("done");
      } else {
        setStep("preview");
      }
    } catch {
      toast({ title: "Error", description: "No se pudo generar el contrato", variant: "destructive" });
      onClose();
    }
  };

  const signContract = async () => {
    if (!contract || !signature) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/contracts/${contract.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signatureBase64: signature, signerName: clientName }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setContract(updated);
      setStep("done");
      toast({ title: "¡Contrato firmado!", description: "El contrato ha sido firmado exitosamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la firma", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const downloadContract = () => {
    if (!contract?.contractHtml) return;
    const blob = new Blob([contract.contractHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contrato-prestamo-${loanId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    generate();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-white">Contrato de Préstamo</span>
            {contract?.signedAt && (
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Firmado
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === "loading" && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
              <p className="text-zinc-400 text-sm">Generando contrato...</p>
            </div>
          </div>
        )}

        {(step === "preview" || step === "signing" || step === "done") && contract && (
          <>
            <div className="flex-1 overflow-y-auto">
              {step !== "signing" ? (
                <iframe
                  srcDoc={contract.contractHtml ?? ""}
                  className="w-full border-0"
                  style={{ height: "50vh", minHeight: 300 }}
                  title="Contrato"
                />
              ) : (
                <div className="p-5 border-b border-zinc-800">
                  <div className="text-sm text-zinc-300 mb-4">
                    <Shield className="w-4 h-4 text-red-400 inline mr-1" />
                    Al firmar confirma que ha leído y acepta los términos del contrato.
                  </div>
                  <SignaturePad
                    onSave={(base64) => setSignature(base64)}
                    onClear={() => setSignature(null)}
                    height={160}
                  />
                  {signature && (
                    <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Firma capturada — presione "Firmar Contrato" para confirmar
                    </div>
                  )}
                </div>
              )}

              {step === "done" && contract.signatureBase64 && (
                <div className="p-5 space-y-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span className="font-semibold text-emerald-400">Contrato firmado digitalmente</span>
                    </div>
                    <div className="text-xs text-zinc-400 space-y-1">
                      <div>Firmado por: <span className="text-white">{contract.signerName}</span></div>
                      <div>Fecha: <span className="text-white">{new Date(contract.signedAt!).toLocaleString("es-DO")}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-2">Firma del prestatario:</p>
                    <img
                      src={contract.signatureBase64}
                      alt="Firma"
                      className="bg-zinc-800 rounded-lg p-2 max-h-20 border border-zinc-700"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-t border-zinc-800 bg-zinc-900/80">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadContract}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Descargar
              </Button>

              <div className="flex-1" />

              {step === "preview" && !contract.signedAt && (
                <Button
                  onClick={() => setStep("signing")}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  Firmar Contrato
                </Button>
              )}

              {step === "signing" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setStep("preview"); setSignature(null); }}
                    className="border-zinc-700 text-zinc-300"
                  >
                    Volver
                  </Button>
                  <Button
                    onClick={signContract}
                    disabled={!signature || saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="sm"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    Firmar Contrato
                  </Button>
                </>
              )}

              {step === "done" && (
                <Button onClick={onClose} className="bg-zinc-700 hover:bg-zinc-600 text-white" size="sm">
                  Cerrar
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
