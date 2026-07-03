import type {
  PixelAssetDocument,
  ValidationResult,
  ValidationIssue,
} from "@pixode/asset-core";
import { runSchemaValidation } from "./schema-validator.js";
import { runDomainValidation, type DomainRule } from "./domain-validator.js";

export interface ValidateOptions {
  extraRules?: DomainRule[];
}

/**
 * Full validation pipeline: schema first, then domain rules.
 * If schema validation fails, domain validation is skipped.
 */
export function validate(
  data: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  const schemaResult = runSchemaValidation(data);
  if (!schemaResult.ok) return schemaResult;

  const domainResult = runDomainValidation(
    data as PixelAssetDocument,
    options.extraRules
  );

  return {
    ok: domainResult.ok,
    errors: domainResult.errors,
    warnings: [...schemaResult.warnings, ...domainResult.warnings],
  };
}

export { runSchemaValidation } from "./schema-validator.js";
export {
  runDomainValidation,
  type DomainRule,
  type DomainRuleContext,
} from "./domain-validator.js";
