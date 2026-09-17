export declare const SCORING_WEIGHTS: {
    readonly sharedSkills: 10;
    readonly sharedInterests: 6;
    readonly mutualCount: 4;
    readonly mutualCountCap: 40;
    readonly sameCollege: 15;
    readonly sameCollegeSimilarity: 30;
    readonly compatibleIntent: 10;
    readonly profileCompleteness: 0.1;
    readonly daysSinceActivePenalty: 0.5;
    readonly daysSinceActiveFloor: -20;
};
export declare const RECOMMENDATION_LIMITS: {
    readonly pageSize: 30;
    readonly maxFirstDegree: 500;
    readonly maxFanOut: 200;
    readonly maxCandidates: 1500;
    readonly cacheExpirySec: number;
    readonly debounceMinutes: 60;
    readonly staleAfterDays: 7;
};
//# sourceMappingURL=scoring.d.ts.map