interface ProfileStats {
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  year_of_study?: number | null;
  branch?: string | null;
  looking_for?: string | null;
  skillCount: number;
  interestCount: number;
  workItemCount: number;
}

export function computeCompleteness(user: ProfileStats): number {
  let score = 0;
  if (user.name) score += 10;
  if (user.bio && user.bio.length >= 20) score += 15;
  if (user.avatar_url) score += 10;
  if (user.year_of_study && user.branch) score += 10;
  if (user.looking_for && user.looking_for !== 'none') score += 10;
  if (user.skillCount >= 3) score += 15;
  if (user.interestCount >= 2) score += 10;
  if (user.workItemCount >= 1) score += 20;
  
  return Math.min(score, 100);
}
