export type AuditLane = 'blocking' | 'actionable-review' | 'manual-review';

export interface AuditViolation {
    path: string;
    line: number;
    message: string;
}

export type ReviewManifestStatus = 'reviewed-clean' | 'accepted-risk' | 'needs-refactor';
export type ReviewStatus = ReviewManifestStatus | 'new' | 'stale';

export interface ReviewedAuditViolation extends AuditViolation {
    reviewStatus?: ReviewStatus;
    reviewNote?: string;
    reviewDate?: string;
    contentHash?: string;
}

export interface AuditCategoryReport {
    key: string;
    label: string;
    lane: AuditLane;
    violations: ReviewedAuditViolation[];
}

export interface ReviewManifestEntry {
    path: string;
    category: string;
    contentHash: string;
    status: ReviewManifestStatus;
    note?: string;
    reviewedAt?: string;
}

export interface ReviewManifestFile {
    entries: ReviewManifestEntry[];
}

export interface AuditSourceFile {
    absolutePath: string;
    relativePath: string;
    content: string;
    lineCount: number;
}

export interface AuditSummary {
    blockingCount: number;
    actionableReviewCount: number;
    manualReviewCount: number;
    unresolvedActionableCount: number;
    unresolvedManualCount: number;
    reviewedCleanCount: number;
    acceptedRiskCount: number;
    staleReviewCount: number;
    manualReviewOutstandingCount: number;
    overallStatus: 'clean' | 'clean-except-accepted-risk' | 'manual-review-outstanding' | 'blocking-violations-present';
}

export interface AuditWorklistOptions {
    lane?: AuditLane;
    category?: string;
    includeReviewed?: boolean;
    newOnly?: boolean;
    staleOnly?: boolean;
}

export interface AgentsConformanceReport {
    handwrittenSourceFilesRequiringReview: ReviewedAuditViolation[];
    handwrittenSourceFilesRequiringStrictReview: ReviewedAuditViolation[];
    absoluteMachinePaths: ReviewedAuditViolation[];
    inlineLintSuppressions: ReviewedAuditViolation[];
    nonTestFrameworkImports: ReviewedAuditViolation[];
    forbiddenLayoutEffects: ReviewedAuditViolation[];
    forbiddenPromiseThenChains: ReviewedAuditViolation[];
    rendererElectronImports: ReviewedAuditViolation[];
    nonPreloadElectronBridgeUsage: ReviewedAuditViolation[];
    insecureBrowserWindows: ReviewedAuditViolation[];
    actionableAsyncOwnership: ReviewedAuditViolation[];
    actionablePlaceholderQueryInputs: ReviewedAuditViolation[];
    actionableCallSiteCasts: ReviewedAuditViolation[];
    nonBlockingReactMemoization: ReviewedAuditViolation[];
    nonBlockingSuspiciousEffects: ReviewedAuditViolation[];
    nonBlockingAsyncEffects: ReviewedAuditViolation[];
    nonBlockingBroadCasts: ReviewedAuditViolation[];
    nonBlockingThrows: ReviewedAuditViolation[];
    categories: AuditCategoryReport[];
    summary: AuditSummary;
}
