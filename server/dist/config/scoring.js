export const SCORING_WEIGHTS = {
    sharedSkills: 10,
    sharedInterests: 6,
    mutualCount: 4,
    mutualCountCap: 40,
    sameCollege: 15,
    sameCollegeSimilarity: 30, // Higher weight for similarity recs
    compatibleIntent: 10,
    profileCompleteness: 0.1, // divided by 10
    daysSinceActivePenalty: 0.5,
    daysSinceActiveFloor: -20,
};
export const RECOMMENDATION_LIMITS = {
    pageSize: 30,
    maxFirstDegree: 500,
    maxFanOut: 200,
    maxCandidates: 1500,
    cacheExpirySec: 7 * 24 * 60 * 60, // 7 days
    debounceMinutes: 60,
    staleAfterDays: 7,
};
//# sourceMappingURL=scoring.js.map