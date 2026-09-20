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
export declare const inviteUser: (groupId: string, inviterId: string, inviteeId: string, note?: string) => Promise<any>;
export declare const getMyInvites: (userId: string) => Promise<{
    id: any;
    groupId: any;
    groupName: any;
    groupDescription: any;
    groupStatus: any;
    inviterId: any;
    inviterName: any;
    inviterAvatarUrl: any;
    collegeName: any;
    note: any;
    status: any;
    createdAt: any;
    updatedAt: any;
}[]>;
export declare const acceptInvite: (inviteId: string, userId: string) => Promise<any>;
export declare const declineInvite: (inviteId: string, userId: string) => Promise<any>;
export declare const deleteGroup: (groupId: string, userId: string) => Promise<{
    success: boolean;
}>;
//# sourceMappingURL=groups.service.d.ts.map