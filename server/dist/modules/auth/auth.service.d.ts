export declare function signup(email: string, password: string, name: string): Promise<{
    user: any;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}>;
export declare function login(email: string, password: string): Promise<{
    user: any;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}>;
export declare function refreshToken(providedRefreshToken: string): Promise<{
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}>;
export declare function logout(providedRefreshToken: string): Promise<void>;
//# sourceMappingURL=auth.service.d.ts.map