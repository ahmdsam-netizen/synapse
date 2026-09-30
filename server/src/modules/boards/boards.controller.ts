import { Response } from 'express';
import * as boardsService from './boards.service.js';
import { AuthRequest } from '../../types/index.js';

export const getGlobalHandler = async (req: AuthRequest, res: Response) => {
  const { cursor, limit, ...filters } = req.query as any;
  const result = await boardsService.getGlobalBoard(cursor, Number(limit), filters, req.user?.id);
  res.json({ status: 'success', data: result });
};

export const getCollegeHandler = async (req: AuthRequest, res: Response) => {
  const { cursor, limit, ...filters } = req.query as any;
  const result = await boardsService.getGlobalBoard(cursor, Number(limit), { ...filters, collegeId: req.user?.collegeId }, req.user?.id);
  res.json({ status: 'success', data: result });
};

export const getMyPostingsHandler = async (req: AuthRequest, res: Response) => {
  const { cursor, limit, community } = req.query as any;
  const result = await boardsService.getMyPostings(req.user!.id, cursor, Number(limit), community);
  res.json({ status: 'success', data: result });
};

export const createPostingHandler = async (req: AuthRequest, res: Response) => {
  const posting = await boardsService.createPosting(req.user!.id, req.body);
  res.status(201).json({ status: 'success', data: posting });
};

export const updatePostingHandler = async (req: AuthRequest, res: Response) => {
  const posting = await boardsService.updatePosting(req.params.id as string, req.user!.id, req.body);
  res.json({ status: 'success', data: posting });
};

export const deletePostingHandler = async (req: AuthRequest, res: Response) => {
  const result = await boardsService.deletePosting(req.params.id as string, req.user!.id);
  res.json({ status: 'success', data: result });
};

export const closePostingHandler = async (req: AuthRequest, res: Response) => {
  await boardsService.closePosting(req.params.id as string, req.user!.id);
  res.json({ status: 'success' });
};

export const getPostingHandler = async (req: AuthRequest, res: Response) => {
  const posting = await boardsService.getPosting(req.params.id as string);
  res.json({ status: 'success', data: posting });
};

export const submitRequestHandler = async (req: AuthRequest, res: Response) => {
  const request = await boardsService.submitJoinRequest(req.user!.id, req.params.id as string, req.body.message);
  res.status(201).json({ status: 'success', data: request });
};

export const getGroupRequestsHandler = async (req: AuthRequest, res: Response) => {
  const requests = await boardsService.getGroupRequests(req.params.id as string, req.user!.id, req.query.status as string);
  res.json({ status: 'success', data: requests });
};

export const approveRequestHandler = async (req: AuthRequest, res: Response) => {
  await boardsService.approveRequest(req.params.id as string, req.user!.id);
  res.json({ status: 'success' });
};

export const rejectRequestHandler = async (req: AuthRequest, res: Response) => {
  await boardsService.rejectRequest(req.params.id as string, req.user!.id);
  res.json({ status: 'success' });
};

export const getMyRequestsHandler = async (req: AuthRequest, res: Response) => {
  const requests = await boardsService.getMyRequests(req.user!.id);
  res.json({ status: 'success', data: requests });
};
