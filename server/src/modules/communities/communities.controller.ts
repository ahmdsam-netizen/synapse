import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import * as communitiesService from './communities.service.js';

export const createHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.createCommunity(req.user!.id, req.body);
  res.status(201).json(result);
};

export const listHandler = async (req: AuthRequest, res: Response) => {
  const search = req.query.q as string | undefined;
  const result = await communitiesService.getCommunities(req.user!.id, search);
  res.status(200).json(result);
};

export const getMyCommunitiesHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.getMyCommunities(req.user!.id);
  res.status(200).json(result);
};

export const getDetailHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.getCommunityDetail(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const joinHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.joinCommunity(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const leaveHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.leaveCommunity(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};

export const deleteHandler = async (req: AuthRequest, res: Response) => {
  const result = await communitiesService.deleteCommunity(req.params.id as string, req.user!.id);
  res.status(200).json(result);
};
