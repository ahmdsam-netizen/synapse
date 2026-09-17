import { PaginationResult } from '../../utils/pagination.js';
export declare function sendRequest(requesterId: string, receiverId: string): Promise<any>;
export declare function acceptConnection(connectionId: string, userId: string): Promise<any>;
export declare function declineConnection(connectionId: string, userId: string): Promise<any>;
export declare function removeConnection(connectionIdOrFriendId: string, userId: string): Promise<{
    removed: boolean;
}>;
export declare function listConnections(userId: string, cursor: string | null, limit: number): Promise<PaginationResult<any>>;
export declare function listPending(userId: string): Promise<{
    id: any;
    requesterId: any;
    requester_id: any;
    receiverId: any;
    receiver_id: any;
    status: any;
    createdAt: any;
    created_at: any;
    name: any;
    avatarUrl: any;
    avatar_url: any;
    bio: any;
    collegeId: any;
    collegeName: any;
    college_name: any;
    yearOfStudy: any;
    year_of_study: any;
    branch: any;
}[]>;
export declare function getMutualConnections(userId: string, otherUserId: string, cursor: string | null, limit: number): Promise<PaginationResult<any>>;
//# sourceMappingURL=connections.service.d.ts.map