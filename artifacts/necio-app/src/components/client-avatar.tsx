import { cn } from "@/lib/utils";

const API_BASE = "/api";

// Reusable client avatar — shows photo if available, else colored initial
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
        src={`${API_BASE}/storage/objects/${avatarUrl}`}
        alt={name}
        className={cn(
          sizeClass,
          "rounded-2xl object-cover shrink-0 shadow-md",
          size === "sm" && "rounded-xl",
          className
        )}
        onError={e => {
          // Fallback to initial if image fails
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div class="${sizeClass} rounded-2xl bg-gradient-to-br from-primary to-rose-900 flex items-center justify-center font-display font-bold text-white shadow-lg shrink-0">${initial}</div>`;
          }
        }}
      />
    );
  }

  // Consistent color based on first letter
  const colors = [
    "from-rose-600 to-red-900",
    "from-violet-600 to-purple-900",
    "from-blue-600 to-indigo-900",
    "from-emerald-600 to-green-900",
    "from-amber-600 to-orange-900",
    "from-cyan-600 to-teal-900",
    "from-pink-600 to-rose-900",
  ];
  const colorIndex = initial.charCodeAt(0) % colors.length;
  const gradient = colors[colorIndex];

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-2xl bg-gradient-to-br flex items-center justify-center font-display font-bold text-white shadow-lg shrink-0",
        gradient,
        size === "sm" && "rounded-xl",
        className
      )}
    >
      {initial}
    </div>
  );
}

// Clickable avatar with upload button (for edit pages)
export function ClientAvatarUpload({
  name,
  avatarUrl,
  onFileSelected,
  uploading,
  previewUrl,
}: {
  name: string;
  avatarUrl?: string | null;
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  previewUrl?: string | null;
}) {
  const displayUrl = previewUrl ?? (avatarUrl ? `${API_BASE}/storage/objects/${avatarUrl}` : null);
  const initial = name.charAt(0).toUpperCase();

  const colors = [
    "from-rose-600 to-red-900",
    "from-violet-600 to-purple-900",
    "from-blue-600 to-indigo-900",
    "from-emerald-600 to-green-900",
    "from-amber-600 to-orange-900",
    "from-cyan-600 to-teal-900",
    "from-pink-600 to-rose-900",
  ];
  const colorIndex = initial.charCodeAt(0) % colors.length;
  const gradient = colors[colorIndex];

  return (
    <label className="relative cursor-pointer group shrink-0">
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={name}
          className="w-24 h-24 rounded-2xl object-cover shadow-lg"
        />
      ) : (
        <div className={cn(
          "w-24 h-24 rounded-2xl bg-gradient-to-br flex items-center justify-center font-display text-3xl font-bold text-white shadow-lg",
          gradient
        )}>
          {initial}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        {uploading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-white text-[10px] font-semibold">Cambiar foto</span>
          </>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />
    </label>
  );
}
