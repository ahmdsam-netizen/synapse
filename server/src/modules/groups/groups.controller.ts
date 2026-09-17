import { Response } from 'express';
import * as groupsService from './groups.service.js';
import { AuthRequest } from '../../types/index.js';

export const createHandler = async (req: AuthRequest, res: Response) => {
  const group = await groupsService.createGroup(req.user!.id, req.user!.collegeId, req.body);
  res.status(201).json({ status: 'success', data: group });
};

export const getMyGroupsHandler = async (req: AuthRequest, res: Response) => {
  const groups = await groupsService.getMyGroups(req.user!.id);
  res.json({ status: 'success', data: groups });
};

export const getDetailHandler = async (req: AuthRequest, res: Response) => {
  const detail = await groupsService.getGroupDetail(req.params.id as string, req.user!.id);
  res.json({ status: 'success', data: detail });
};

export const updateHandler = async (req: AuthRequest, res: Response) => {
  const group = await groupsService.updateGroup(req.params.id as string, req.user!.id, req.body);
  res.json({ status: 'success', data: group });
};

export const removeMemberHandler = async (req: AuthRequest, res: Response) => {
  await groupsService.removeMember(req.params.id as string, req.params.userId as string, req.user!.id);
  res.json({ status: 'success' });
};

export const promoteMemberHandler = async (req: AuthRequest, res: Response) => {
  await groupsService.promoteMember(req.params.id as string, req.params.userId as string, req.user!.id);
  res.json({ status: 'success' });
};
