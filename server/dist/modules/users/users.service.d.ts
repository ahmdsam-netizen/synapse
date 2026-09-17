export declare function getProfile(viewerId: string | null, targetId: string): Promise<any>;
export declare function getMe(userId: string): Promise<any>;
export declare function updateProfile(userId: string, data: any): Promise<any>;
export declare function addSkill(userId: string, payload: {
    skillId?: string;
    name?: string;
    proficiency: string;
}): Promise<{
    id: string;
    skill_id: string;
    name: any;
    category: any;
    proficiency: string;
}>;
export declare function removeSkill(userId: string, skillId: string): Promise<void>;
export declare function addInterest(userId: string, payload: {
    interestId?: string;
    name?: string;
}): Promise<{
    id: string;
    interest_id: string;
    name: any;
    category: any;
}>;
export declare function removeInterest(userId: string, interestId: string): Promise<void>;
export declare function createWorkItem(userId: string, data: any): Promise<any>;
export declare function updateWorkItem(userId: string, workItemId: string, data: any): Promise<any>;
export declare function deleteWorkItem(userId: string, workItemId: string): Promise<void>;
export declare function searchSkills(q: string): Promise<any[]>;
export declare function searchInterests(q: string): Promise<any[]>;
//# sourceMappingURL=users.service.d.ts.map