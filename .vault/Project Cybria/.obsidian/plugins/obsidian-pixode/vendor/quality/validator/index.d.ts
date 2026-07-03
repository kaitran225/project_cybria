import type { ValidationResult } from "@pixode/asset-core";
import { type DomainRule } from "./domain-validator.js";
export interface ValidateOptions {
    extraRules?: DomainRule[];
}
/**
 * Full validation pipeline: schema first, then domain rules.
 * If schema validation fails, domain validation is skipped.
 */
export declare function validate(data: unknown, options?: ValidateOptions): ValidationResult;
export { runSchemaValidation } from "./schema-validator.js";
export { runDomainValidation, type DomainRule, type DomainRuleContext, } from "./domain-validator.js";
//# sourceMappingURL=index.d.ts.map