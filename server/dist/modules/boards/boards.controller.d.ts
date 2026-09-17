import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
export declare const getGlobalHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getCollegeHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMatchedHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMyPostingsHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createPostingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updatePostingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const deletePostingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const closePostingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getPostingHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const submitRequestHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getGroupRequestsHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const approveRequestHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const rejectRequestHandler: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getMyRequestsHandler: (req: AuthRequest, res: Response) => Promise<void>;
//# sourceMappingURL=boards.controller.d.ts.map