export { validate, type ValidateOptions, runSchemaValidation, runDomainValidation, type DomainRule, type DomainRuleContext, } from "./validator/index.js";
export type { AssetFingerprint, ConsistencyReport, OutlierGroup } from "./consistency/types.js";
export { fingerprint } from "./consistency/fingerprint.js";
export { analyzeProject, findOutliers } from "./consistency/analyze.js";
export type { AnalyticsEvent, StudioMetrics, CategoryMetrics } from "./analytics/types.js";
export { createEvent } from "./analytics/create-event.js";
export { aggregate } from "./analytics/aggregate.js";
export type { Revision, RevisionLog, AssetDiff } from "./revision/types.js";
export { createRevisionLog, createRevision, getRevision, getHead, getRegionHistory, } from "./revision/revision-log.js";
export { diffDocuments } from "./revision/diff.js";
//# sourceMappingURL=index.d.ts.map