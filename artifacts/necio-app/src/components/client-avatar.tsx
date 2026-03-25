import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Camera, X, Maximize2, Loader2 } from "lucide-react";

const API_BASE = "/api";

function avatarKey(avatarUrl: string): string {
  return avatarUrl.startsWith("/objects/")
    ? avatarUrl.slice("/objects/".length)
    : avatarUrl;
}

export function avatarSrc(avatarUrl: string): string {
  return `${API_BASE}/storage/objects/${avatarKey(avatarUrl)}`;
}

export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors bg-black/40 rounded-full p-1.5"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

const COLORS = [
  "from-rose-600 to-red-900",
  "from-violet-600 to-purple-900",
  "from-blue-600 to-indigo-900",
  "from-emerald-600 to-green-900",
  "from-amber-600 to-orange-900",
  "from-cyan-600 to-teal-900",
  "from-pink-600 to-rose-900",
];

function avatarGradient(initial: string) {
  return COLORS[initial.charCodeAt(0) % COLORS.length];
}

export function ClientAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClass = {
    sm: "w-9 h-9 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-2xl",
    xl: "w-20 h-20 text-3xl",
  }[size];

  const initial = name.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarSrc(avatarUrl)}
        alt={name}
        className={cn(
          sizeClass,
          "rounded-2xl object-cover shrink-0 shadow-md",
          size === "sm" && "rounded-xl",
          className
        )}
        onError={e => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement("div");
            fallback.className = `${sizeClass} rounded-2xl bg-gradient-to-br from-primary to-rose-900 flex items-center justify-center font-display font-bold text-white shadow-lg shrink-0`;
            fallback.textContent = initial;
            parent.replaceChildren(fallback);
          }
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-2xl bg-gradient-to-br flex items-center justify-center font-display font-bold text-white shadow-lg shrink-0",
        avatarGradient(initial),
        size === "sm" && "rounded-xl",
        className
      )}
    >
      {initial}
    </div>
  );
}

export function ClientAvatarUpload({
  name,
  avatarUrl,
  onFileSelected,
  onRemove,
  uploading,
  previewUrl,
}: {
  name: string;
  avatarUrl?: string | null;
  onFileSelected: (file: File) => void;
  onRemove?: () => void;
  uploading?: boolean;
  previewUrl?: string | null;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl ?? (avatarUrl ? avatarSrc(avatarUrl) : null);
  const hasPhoto = !!displayUrl;
  const initial = name.charAt(0).toUpperCase();

  return (
    <>
      <div className="flex flex-col items-center gap-2.5">
        {hasPhoto ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group shrink-0"
            title="Ver foto en grande"
          >
            <img
              src={displayUrl!}
              alt={name}
              className="w-24 h-24 rounded-2xl object-cover shadow-lg"
            />
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </button>
        ) : (
          <div
            className={cn(
              "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center font-display text-3xl font-bold text-white shadow-lg shrink-0",
              avatarGradient(initial)
            )}
          >
            {initial}
          </div>
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/70 text-foreground transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            {uploading ? "Subiendo..." : hasPhoto ? "Cambiar foto" : "Agregar foto"}
          </button>

          {hasPhoto && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Quitar
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = "";
        }}
      />

      {lightboxOpen && displayUrl && (
        <PhotoLightbox
          src={displayUrl}
          alt={name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
