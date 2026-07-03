import { validateSchema } from "@pixode/asset-core";
export function runSchemaValidation(data) {
    const result = validateSchema(data);
    if (result.valid) {
        return { ok: true, errors: [], warnings: [] };
    }
    return {
        ok: false,
        errors: result.errors.map((e) => ({
            code: "SCHEMA_ERROR",
            path: e.path,
            message: e.message,
        })),
        warnings: [],
    };
}
//# sourceMappingURL=schema-validator.js.map