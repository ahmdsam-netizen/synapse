import { Request, Response } from 'express';
import { getSecondDegreeRecs, getSimilarityRecs } from './recommendations.service.js';
import { AuthRequest } from '../../types/index.js';

export async function getSecondDegreeHandler(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const userId = authReq.user!.id;
  const collegeId = authReq.user!.collegeId;
  const cursor = req.query.cursor as string | null || null;
  const limit = parseInt(req.query.limit as string, 10) || 30;

  const result = await getSecondDegreeRecs(userId, collegeId, cursor, limit);
  res.json(result);
}

export async function getSimilarityHandler(req: Request, res: Response) {
  const authReq = req as AuthRequest;
  const userId = authReq.user!.id;
  const collegeId = authReq.user!.collegeId;
  const cursor = req.query.cursor as string | null || null;
  const limit = parseInt(req.query.limit as string, 10) || 30;

  const result = await getSimilarityRecs(userId, collegeId, cursor, limit);
  res.json(result);
}
