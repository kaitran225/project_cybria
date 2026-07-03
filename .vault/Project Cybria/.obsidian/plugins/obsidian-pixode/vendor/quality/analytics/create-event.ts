import type { AnalyticsEvent } from "./types.js";

export function createEvent(
  type: AnalyticsEvent["type"],
  data: Record<string, unknown> & { ts?: string }
): AnalyticsEvent {
  return { type, ts: data.ts ?? new Date().toISOString(), ...data } as AnalyticsEvent;
}
