export declare function getSimilarityRecs(userId: string, collegeId: string | null, cursor: string | null, limit: number): Promise<{
    data: {
        id: any;
        name: any;
        avatarUrl: any;
        headline: any;
        collegeId: any;
        collegeName: any;
        year: any;
        yearOfStudy: any;
        branch: any;
        lookingFor: any;
        sameCollege: boolean;
        score: any;
        mutualCount: any;
        viaConnection: any;
        matchedSkills: any;
        matchedInterests: any;
        skills: any;
        interests: any;
        allSkills: any;
        allInterests: any;
    }[];
    nextCursor: string | null;
    hasMore: boolean;
    source: string;
}>;
export declare function getSecondDegreeRecs(userId: string, collegeId: string | null, cursor: string | null, limit: number): Promise<{
    data: {
        id: any;
        name: any;
        avatarUrl: any;
        headline: any;
        collegeId: any;
        collegeName: any;
        year: any;
        yearOfStudy: any;
        branch: any;
        lookingFor: any;
        sameCollege: boolean;
        score: any;
        mutualCount: any;
        viaConnection: any;
        matchedSkills: any;
        matchedInterests: any;
        skills: any;
        interests: any;
        allSkills: any;
        allInterests: any;
    }[];
    nextCursor: string | null;
    hasMore: boolean;
    source: string;
}>;
//# sourceMappingURL=recommendations.service.d.ts.map