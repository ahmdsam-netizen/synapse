interface ProfileStats {
    name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    year_of_study?: number | null;
    branch?: string | null;
    looking_for?: string | null;
    skillCount: number;
    interestCount: number;
    workItemCount: number;
}
export declare function computeCompleteness(user: ProfileStats): number;
export {};
//# sourceMappingURL=profileCompleteness.d.ts.map