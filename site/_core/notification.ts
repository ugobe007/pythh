/** Owner notification hook (Stripe webhooks, etc.). */

export async function notifyOwner(message: string): Promise<void> {
  console.warn("[notifyOwner]", message);
}
