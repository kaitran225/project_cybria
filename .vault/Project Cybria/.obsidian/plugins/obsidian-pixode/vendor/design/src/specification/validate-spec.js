import { validateSpecSchema } from "./schema.js";
export function validateSpec(data) {
    const schema = validateSpecSchema(data);
    if (!schema.valid) {
        return {
            ok: false,
            errors: schema.errors.map((e) => ({
                code: "SPEC_SCHEMA",
                path: e.path,
                message: e.message,
            })),
        };
    }
    const spec = data;
    const errors = [];
    if (!spec.blueprintId) {
        errors.push({ code: "SPEC_NO_BLUEPRINT", path: "/blueprintId", message: "blueprintId is required" });
    }
    if (!spec.styleId) {
        errors.push({ code: "SPEC_NO_STYLE", path: "/styleId", message: "styleId is required" });
    }
    return { ok: errors.length === 0, errors };
}
//# sourceMappingURL=validate-spec.js.map