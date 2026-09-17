import { Response } from 'express';
import { AuthRequest } from '../../types/index.js';
import * as authService from './auth.service.js';

export const signupHandler = async (req: AuthRequest, res: Response) => {
  const { email, password, name } = req.body;
  const result = await authService.signup(email, password, name);
  res.status(201).json(result);
};

export const loginHandler = async (req: AuthRequest, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json(result);
};

export const refreshHandler = async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshToken(refreshToken);
  res.status(200).json(result);
};

export const logoutHandler = async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.status(200).json({ message: 'Logged out' });
};
