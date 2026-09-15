import { Request, Response } from 'express';
import * as usersService from './users.service';

export async function getProfileHandler(req: Request, res: Response) {
  // @ts-ignore
  const viewerId = req.user?.id || null;
  const profile = await usersService.getProfile(viewerId, req.params.id);
  res.json({ data: profile });
}

export async function getMeHandler(req: Request, res: Response) {
  // @ts-ignore
  const profile = await usersService.getMe(req.user.id);
  res.json({ data: profile });
}

export async function updateProfileHandler(req: Request, res: Response) {
  // @ts-ignore
  const profile = await usersService.updateProfile(req.user.id, req.body);
  res.json({ data: profile });
}

export async function addSkillHandler(req: Request, res: Response) {
  // @ts-ignore
  const skill = await usersService.addSkill(req.user.id, req.body.skillId, req.body.proficiency);
  res.json({ data: skill });
}

export async function removeSkillHandler(req: Request, res: Response) {
  // @ts-ignore
  await usersService.removeSkill(req.user.id, req.params.skillId);
  res.status(204).send();
}

export async function addInterestHandler(req: Request, res: Response) {
  // @ts-ignore
  const interest = await usersService.addInterest(req.user.id, req.body.interestId);
  res.json({ data: interest });
}

export async function removeInterestHandler(req: Request, res: Response) {
  // @ts-ignore
  await usersService.removeInterest(req.user.id, req.params.interestId);
  res.status(204).send();
}

export async function createWorkItemHandler(req: Request, res: Response) {
  // @ts-ignore
  const workItem = await usersService.createWorkItem(req.user.id, req.body);
  res.status(201).json({ data: workItem });
}

export async function updateWorkItemHandler(req: Request, res: Response) {
  // @ts-ignore
  const workItem = await usersService.updateWorkItem(req.user.id, req.params.id, req.body);
  res.json({ data: workItem });
}

export async function deleteWorkItemHandler(req: Request, res: Response) {
  // @ts-ignore
  await usersService.deleteWorkItem(req.user.id, req.params.id);
  res.status(204).send();
}

export async function searchSkillsHandler(req: Request, res: Response) {
  const q = req.query.q as string || '';
  const skills = await usersService.searchSkills(q);
  res.json({ data: skills });
}

export async function searchInterestsHandler(req: Request, res: Response) {
  const q = req.query.q as string || '';
  const interests = await usersService.searchInterests(q);
  res.json({ data: interests });
}
