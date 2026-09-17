import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  collegeId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined';
export type LookingFor = 'project' | 'event' | 'both' | 'none';
export type Proficiency = 'beginner' | 'intermediate' | 'advanced';
export type GroupRole = 'admin' | 'member';
export type GroupVisibility = 'global' | 'college';
export type GroupStatus = 'open' | 'closed';
export type BoardType = 'global' | 'matched';
export type PostingStatus = 'open' | 'closed';
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';
export type RecType = 'second_degree' | 'similarity';
