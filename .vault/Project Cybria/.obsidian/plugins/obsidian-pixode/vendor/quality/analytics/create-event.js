export function createEvent(type, data) {
    return { type, ts: data.ts ?? new Date().toISOString(), ...data };
}
//# sourceMappingURL=create-event.js.map