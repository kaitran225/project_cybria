export type AnalyticsEvent = {
    type: "asset.generated";
    assetId: string;
    specId?: string;
    backend?: string;
    ts: string;
} | {
    type: "asset.validated";
    assetId: string;
    ok: boolean;
    errorCount: number;
    ts: string;
} | {
    type: "asset.reviewed";
    assetId: string;
    score: number;
    ts: string;
} | {
    type: "asset.approved";
    assetId: string;
    by: string;
    ts: string;
} | {
    type: "asset.rejected";
    assetId: string;
    reason: string;
    ts: string;
} | {
    type: "asset.revised";
    assetId: string;
    revision: number;
    ts: string;
} | {
    type: "asset.exported";
    assetId: string;
    target: string;
    ts: string;
} | {
    type: "style.violation";
    assetId: string;
    code: string;
    ts: string;
} | {
    type: "batch.completed";
    jobId: string;
    count: number;
    ts: string;
} | {
    type: "batch.failed";
    jobId: string;
    error: string;
    ts: string;
};
export interface CategoryMetrics {
    generated: number;
    approved: number;
    rejected: number;
}
export interface StudioMetrics {
    generated: number;
    approved: number;
    rejected: number;
    exported: number;
    avgRevisionCount: number;
    avgReviewScore: number;
    styleViolations: number;
    batchesCompleted: number;
    byCategory: Record<string, CategoryMetrics>;
}
//# sourceMappingURL=types.d.ts.map