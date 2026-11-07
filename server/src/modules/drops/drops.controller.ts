import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import * as dropsService from './drops.service.js';

export const createDropHandler = async (req: AuthRequest, res: Response) => {
  const drop = await dropsService.createDrop(req.user!.id, req.body.content);
  res.status(201).json({ status: 'success', data: drop });
};

export const getDropsHandler = async (req: AuthRequest, res: Response) => {
  const { cursor, limit } = req.query as any;
  const result = await dropsService.getDrops(req.user!.id, cursor, limit ? Number(limit) : 20);
  res.json({ status: 'success', data: result });
};

export const voteDropHandler = async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const { voteType } = req.body as { voteType: 'up' | 'down' };
  const result = await dropsService.voteDrop(req.user!.id, id, voteType);
  res.json({ status: 'success', data: result });
};

export const deleteDropHandler = async (req: AuthRequest, res: Response) => {
  const { id } = req.params as { id: string };
  const result = await dropsService.deleteDrop(req.user!.id, id);
  res.json({ status: 'success', data: result });
};
