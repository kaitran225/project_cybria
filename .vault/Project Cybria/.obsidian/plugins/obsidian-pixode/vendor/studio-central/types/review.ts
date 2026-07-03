export type IssueCategory = "style" | "readability" | "animation" | "structure";
export type IssueSeverity = "error" | "warning" | "info";

export interface DirectorIssue {
  category: IssueCategory;
  severity: IssueSeverity;
  region?: string;
  message: string;
}

export interface DirectorReport {
  score: number;
  issues: DirectorIssue[];
  suggestions: string[];
}

export const DISABLED_REVIEW_REPORT: DirectorReport = {
  score: 0,
  issues: [
    {
      category: "structure",
      severity: "info",
      message: "Review engine disabled",
    },
  ],
  suggestions: [],
};
