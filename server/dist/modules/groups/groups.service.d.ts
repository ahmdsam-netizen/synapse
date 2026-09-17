export declare const createGroup: (userId: string, collegeId: string | null, data: any) => Promise<any>;
export declare const getMyGroups: (userId: string) => Promise<any[]>;
export declare const getGroupDetail: (groupId: string, viewerId: string) => Promise<any>;
export declare const updateGroup: (groupId: string, userId: string, data: any) => Promise<any>;
export declare const removeMember: (groupId: string, targetUserId: string, actingUserId: string) => Promise<{
    success: boolean;
}>;
export declare const promoteMember: (groupId: string, targetUserId: string, actingUserId: string) => Promise<{
    success: boolean;
}>;
//# sourceMappingURL=groups.service.d.ts.map