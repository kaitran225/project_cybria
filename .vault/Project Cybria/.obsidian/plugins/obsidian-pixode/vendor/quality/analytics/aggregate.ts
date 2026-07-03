import type { AnalyticsEvent, StudioMetrics } from "./types.js";

export function aggregate(events: AnalyticsEvent[]): StudioMetrics {
  const metrics: StudioMetrics = {
    generated: 0,
    approved: 0,
    rejected: 0,
    exported: 0,
    avgRevisionCount: 0,
    avgReviewScore: 0,
    styleViolations: 0,
    batchesCompleted: 0,
    byCategory: {},
  };

  let reviewTotal = 0;
  let reviewCount = 0;
  let revisionTotal = 0;
  let revisionCount = 0;

  for (const e of events) {
    switch (e.type) {
      case "asset.generated":
        metrics.generated++;
        break;
      case "asset.approved":
        metrics.approved++;
        break;
      case "asset.rejected":
        metrics.rejected++;
        break;
      case "asset.exported":
        metrics.exported++;
        break;
      case "asset.reviewed":
        reviewTotal += e.score;
        reviewCount++;
        break;
      case "asset.revised":
        revisionTotal += e.revision;
        revisionCount++;
        break;
      case "style.violation":
        metrics.styleViolations++;
        break;
      case "batch.completed":
        metrics.batchesCompleted++;
        break;
    }
  }

  metrics.avgReviewScore = reviewCount > 0 ? Math.round(reviewTotal / reviewCount) : 0;
  metrics.avgRevisionCount = revisionCount > 0 ? revisionTotal / revisionCount : 0;

  return metrics;
}
