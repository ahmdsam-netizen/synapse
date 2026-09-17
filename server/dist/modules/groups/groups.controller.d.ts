import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
export declare const createHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMyGroupsHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getDetailHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const removeMemberHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const promoteMemberHandler: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=groups.controller.d.ts.map