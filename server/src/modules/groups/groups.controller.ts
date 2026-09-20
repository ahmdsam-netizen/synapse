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

export const inviteUserHandler = async (req: AuthRequest, res: Response) => {
  const invite = await groupsService.inviteUser(
    req.params.id as string,
    req.user!.id,
    req.body.userId,
    req.body.note
  );
  res.status(201).json({ status: 'success', data: invite });
};

export const getMyInvitesHandler = async (req: AuthRequest, res: Response) => {
  const invites = await groupsService.getMyInvites(req.user!.id);
  res.json({ status: 'success', data: invites });
};

export const acceptInviteHandler = async (req: AuthRequest, res: Response) => {
  const result = await groupsService.acceptInvite(req.params.inviteId as string, req.user!.id);
  res.json({ status: 'success', data: result });
};

export const declineInviteHandler = async (req: AuthRequest, res: Response) => {
  const result = await groupsService.declineInvite(req.params.inviteId as string, req.user!.id);
  res.json({ status: 'success', data: result });
};

export const deleteHandler = async (req: AuthRequest, res: Response) => {
  await groupsService.deleteGroup(req.params.id as string, req.user!.id);
  res.json({ status: 'success', message: 'Group deleted successfully' });
};


