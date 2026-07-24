/**
 * Lightweight in-process event bus (COMMUNICATIONS_DESIGN §4, §11).
 *
 * Existing routes call `emit('delivery.scheduled', payload)` after a
 * successful transaction. In Phase 1 there are no subscribers yet — the
 * trigger engine that turns events into messages is Session 2. The bus
 * exists now so Session 1 can wire the emit calls without a second pass,
 * and so nothing here has to be refactored later.
 *
 * Design intent: fire-and-forget, never throw into the caller. A misbehaving
 * subscriber must not roll back the domain mutation that emitted the event.
 */

/** Every event the app can emit. Stable string keys — persisted on
 *  tbl_message_trigger.event_key and offered in the trigger editor. */
export const EVENT_KEYS = [
  // Delivery
  'delivery.scheduled',
  'delivery.rescheduled',
  'delivery.completed',
  'delivery.cancelled',
  // Pickup
  'pickup.scheduled',
  'pickup.confirmed',
  'pickup.completed',
  'pickup.cancelled',
  // Donation
  'donation.received',
  'donation.receipt_sent',
  // Client / referral / agency / volunteer
  'referral.submitted',
  'referral.approved',
  'referral.rejected',
  'client.status_changed',
  'agency_application.submitted',
  'agency_application.approved',
  'agency_application.rejected',
  'caseworker.invited',
  'caseworker.registered',
  'volunteer.signup_submitted',
  'volunteer.approved',
  // Provisioning
  'request.submitted',
  'request.matched',
  'request.scheduled',
] as const;

export type MessagingEventKey = (typeof EVENT_KEYS)[number];

export function isKnownEventKey(key: string): key is MessagingEventKey {
  return (EVENT_KEYS as readonly string[]).includes(key);
}

export type EventPayload = Record<string, unknown>;
export type EventHandler = (payload: EventPayload, key: MessagingEventKey) => void | Promise<void>;

const handlers = new Map<string, Set<EventHandler>>();

/** Subscribe to an event. Returns an unsubscribe function. */
export function on(key: MessagingEventKey, handler: EventHandler): () => void {
  let set = handlers.get(key);
  if (!set) {
    set = new Set();
    handlers.set(key, set);
  }
  set.add(handler);
  return () => { handlers.get(key)?.delete(handler); };
}

/**
 * Emit an event to all subscribers. Never throws — a subscriber error is
 * logged and swallowed so the emitting route's response is unaffected.
 * Awaitable, but callers typically fire-and-forget with `void emit(...)`.
 */
export async function emit(key: MessagingEventKey, payload: EventPayload = {}): Promise<void> {
  const set = handlers.get(key);
  if (!set || set.size === 0) return;
  for (const handler of set) {
    try {
      await handler(payload, key);
    } catch (err) {
      console.error(`[messaging] event handler for "${key}" failed:`, err);
    }
  }
}
