import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
export declare const signupHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const loginHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const refreshHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const logoutHandler: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=auth.controller.d.ts.map