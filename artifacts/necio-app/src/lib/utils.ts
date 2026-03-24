import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRD(amount: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('DOP', 'RD$');
}

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return 'N/A';
  try {
    // Handle both YYYY-MM-DD and ISO strings
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    
    return new Intl.DateTimeFormat('es-DO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch {
    return 'Fecha inválida';
  }
}

// Ensure the first letter is capitalized for statuses
export function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
