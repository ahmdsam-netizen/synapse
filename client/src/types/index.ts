export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  collegeId: string;
  collegeName?: string;
  yearOfStudy: number | null;
  branch: string | null;
  lookingFor: 'project' | 'event' | 'both' | 'none';
  openToInvites?: boolean;
  open_to_invites?: boolean;
  profileCompleteness: number;
  lastActive: string;
  createdAt: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface Interest {
  id: string;
  name: string;
  category: string;
}

export interface UserSkill extends Skill {
  proficiency: 'beginner' | 'intermediate' | 'advanced';
}

export interface WorkItem {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  techUsed: string[];
  repoUrl: string | null;
  liveUrl: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

export interface Connection {
  id: string;
  requesterId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
  user: User; // The other user in the connection
}

export interface UserProfile extends User {
  skills: UserSkill[];
  interests: Interest[];
  workItems: WorkItem[];
  connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'connected';
  connectionId: string | null;
  mutualCount: number;
  college: { id: string; name: string; city: string } | null;
}

export interface RecommendedUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  collegeName: string;
  yearOfStudy: number | null;
  branch: string | null;
  lookingFor: string;
  profileCompleteness: number;
  score: number;
  mutualCount: number;
  viaConnection: { id: string; name: string } | null;
  matchedSkills: Skill[];
  matchedInterests: Interest[];
  skills: UserSkill[];
  sameCollege?: boolean;
  matchScore?: number;
  matchPercentage?: number;
  match_percentage?: number;
  similarity_score?: number;
  similarityScore?: number;
  source?: string;
  year?: number | null;
  viaConnectionName?: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  collegeId: string | null;
  visibility: 'global' | 'college';
  maxMembers: number;
  status: 'open' | 'closed';
  memberCount: number;
  userRole?: 'admin' | 'member';
  pendingRequestCount?: number;
  createdAt: string;
  expiresAt?: string | null;
  expires_at?: string | null;
  durationDays?: number;
  isCommunity?: boolean;
  is_community?: boolean;
}

export interface Community {
  id: string;
  name: string;
  description?: string | null;
  creatorId?: string;
  creator_id?: string;
  visibility: 'global';
  maxMembers: number;
  max_members?: number;
  memberCount: number;
  member_count?: number;
  status: 'open' | 'closed';
  isCommunity: boolean;
  is_community?: boolean;
  isMember?: boolean;
  userRole?: 'admin' | 'member' | null;
  createdAt: string;
  created_at?: string;
  expiresAt?: null;
  expires_at?: null;
  members?: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    role: 'admin' | 'member';
    joinedAt?: string;
    joined_at?: string;
    collegeName?: string | null;
    college_name?: string | null;
    branch?: string | null;
    yearOfStudy?: number | null;
  }>;
}

export interface BoardPosting {
  id: string;
  groupId: string;
  groupName: string;
  creatorId?: string;
  creator_id?: string;
  boardType: 'global' | 'matched';
  title: string;
  description: string | null;
  rolesNeeded: string[];
  requiredSkillIds: string[];
  requiredInterestIds: string[];
  requiredSkills?: Skill[];
  requiredInterests?: Interest[];
  matchedSkills?: Skill[];
  matchedInterests?: Interest[];
  community?: 'project' | 'hackathon' | 'competition';
  slotsTotal?: number;
  slotsFilled?: number;
  status: 'open' | 'closed';
  createdAt: string;
  hasRequested?: boolean;
  expiresAt?: string | null;
  expires_at?: string | null;
  matchPercentage?: number;
  match_percentage?: number;
  semantic_match_score?: number;
  semanticMatchScore?: number;
  matchScore?: number;
  collegeName?: string;
  college_name?: string;
}

export interface JoinRequest {
  id: string;
  postingId: string;
  groupId: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  postingTitle?: string;
  groupName?: string;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string;
  groupDescription?: string | null;
  groupStatus?: 'open' | 'closed';
  inviterId: string;
  inviterName: string;
  inviterAvatarUrl?: string | null;
  collegeName?: string | null;
  note?: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

