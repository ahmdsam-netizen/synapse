import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
export declare const requireAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map