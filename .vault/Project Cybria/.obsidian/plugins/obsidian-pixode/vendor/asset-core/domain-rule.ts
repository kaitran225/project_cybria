import type { PixelAssetDocument, ValidationIssue } from "./types.js";

export interface DomainRuleContext {
  doc: PixelAssetDocument;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export type DomainRule = (ctx: DomainRuleContext) => void;
