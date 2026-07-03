import { appendFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";
import type { AnalyticsEvent } from "./types.js";
import { createEvent } from "./create-event.js";

export { createEvent };

export function emit(event: AnalyticsEvent, eventsPath: string): void {
  mkdirSync(dirname(eventsPath), { recursive: true });
  appendFileSync(eventsPath, JSON.stringify(event) + "\n");
}

export function loadEvents(eventsPath: string): AnalyticsEvent[] {
  if (!existsSync(eventsPath)) return [];
  return readFileSync(eventsPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AnalyticsEvent);
}
