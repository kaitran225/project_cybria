import { runSchemaValidation } from "./schema-validator.js";
import { runDomainValidation } from "./domain-validator.js";
/**
 * Full validation pipeline: schema first, then domain rules.
 * If schema validation fails, domain validation is skipped.
 */
export function validate(data, options = {}) {
    const schemaResult = runSchemaValidation(data);
    if (!schemaResult.ok)
        return schemaResult;
    const domainResult = runDomainValidation(data, options.extraRules);
    return {
        ok: domainResult.ok,
        errors: domainResult.errors,
        warnings: [...schemaResult.warnings, ...domainResult.warnings],
    };
}
export { runSchemaValidation } from "./schema-validator.js";
export { runDomainValidation, } from "./domain-validator.js";
//# sourceMappingURL=index.js.map