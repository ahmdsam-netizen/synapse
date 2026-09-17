import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import * as connectionsService from './connections.service.js';

export const sendRequestHandler = async (req: AuthRequest, res: Response) => {
  const result = await connectionsService.sendRequest(req.user!.id, req.body.receiverId);
  res.status(201).json(result);
};

export const acceptHandler = async (req: AuthRequest, res: Response) => {
  const result = await connectionsService.acceptConnection(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const declineHandler = async (req: AuthRequest, res: Response) => {
  const result = await connectionsService.declineConnection(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const removeHandler = async (req: AuthRequest, res: Response) => {
  const result = await connectionsService.removeConnection(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const listHandler = async (req: AuthRequest, res: Response) => {
  const cursor = (req.query.cursor as string) || null;
  const limit = Number(req.query.limit) || 30;
  const result = await connectionsService.listConnections(req.user!.id, cursor, limit);
  res.status(200).json(result);
};

export const pendingHandler = async (req: AuthRequest, res: Response) => {
  const result = await connectionsService.listPending(req.user!.id);
  res.status(200).json(result);
};

export const mutualHandler = async (req: AuthRequest, res: Response) => {
  const cursor = (req.query.cursor as string) || null;
  const limit = Number(req.query.limit) || 30;
  const result = await connectionsService.getMutualConnections(req.user!.id, req.params.userId as string, cursor, limit);
  res.status(200).json(result);
};
