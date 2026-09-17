import { PaginationResult } from '../../utils/pagination.js';
interface SearchFilters {
    q?: string;
    skills?: string[];
    interests?: string[];
    matchMode?: 'any' | 'all';
    collegeId?: string;
    college?: string;
    year?: number;
    lookingFor?: string;
    cursor?: string;
    limit?: number;
}
export declare const searchUsers: (userId: string, _collegeId: string | null, filters: SearchFilters) => Promise<PaginationResult<any>>;
export {};
//# sourceMappingURL=search.service.d.ts.map