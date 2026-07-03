export { validate, runSchemaValidation, runDomainValidation, } from "./validator/index.js";
export { fingerprint } from "./consistency/fingerprint.js";
export { analyzeProject, findOutliers } from "./consistency/analyze.js";
export { createEvent } from "./analytics/create-event.js";
export { aggregate } from "./analytics/aggregate.js";
export { createRevisionLog, createRevision, getRevision, getHead, getRegionHistory, } from "./revision/revision-log.js";
export { diffDocuments } from "./revision/diff.js";
//# sourceMappingURL=index.js.map