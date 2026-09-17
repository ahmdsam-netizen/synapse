import { Request, Response } from 'express';
import { searchUsers } from './search.service.js';
import { AuthRequest } from '../../types/index.js';

export const searchUsersHandler = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const collegeId = req.user!.collegeId;
  const filters = req.query as any;

  const result = await searchUsers(userId, collegeId, filters);

  res.json(result);
};
