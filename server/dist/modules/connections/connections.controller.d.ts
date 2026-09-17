import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
export declare const sendRequestHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const acceptHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const declineHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const removeHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const listHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const pendingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const mutualHandler: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=connections.controller.d.ts.map