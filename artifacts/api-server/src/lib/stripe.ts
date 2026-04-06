/**
 * Stripe eliminado — sistema de pagos reemplazado por transferencia bancaria manual.
 * Este archivo existe solo para que las importaciones existentes no rompan la compilación.
 */

export async function getUncachableStripeClient(): Promise<null> {
  return null;
}

export async function getStripePublishableKey(): Promise<null> {
  return null;
}
