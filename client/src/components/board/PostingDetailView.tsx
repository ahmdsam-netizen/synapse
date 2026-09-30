import {
  ArrowLeftIcon,
  ClockIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { BoardPosting } from '../../types';
import { TagChip } from '../shared/TagChip';
import { timeAgo, formatTimeRemaining } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

interface PostingDetailViewProps {
  posting: BoardPosting & {
    hasRequested?: boolean;
    isOwner?: boolean;
    pendingRequestCount?: number;
  };
  onBack: () => void;
  onRequestClick: () => void;
  onDeleteClick?: () => void;
  isMatchedTab?: boolean;
}

export function PostingDetailView({
  posting,
  onBack,
  onRequestClick,
  onDeleteClick,
  isMatchedTab = false,
}: PostingDetailViewProps) {
  const { user: currentUser } = useAuth();
  const isSelfPost =
    Boolean(posting.isOwner) ||
    (Boolean(currentUser?.id) &&
      (posting.creatorId === currentUser?.id ||
        (posting as any).creator_id === currentUser?.id));

  const groupName = posting.groupName || (posting as any).group_name || 'Group';
  const rolesNeeded = posting.rolesNeeded || (posting as any).roles_needed || [];
  const requiredSkills =
    posting.requiredSkills || (posting as any).required_skills || [];
  const requiredInterests =
    posting.requiredInterests || (posting as any).required_interests || [];
  const community = ((posting.community || (posting as any).community || 'project') as string).toLowerCase();
  const hasRequested =
    posting.hasRequested ?? (posting as any).has_requested ?? false;
  const expiresAt = posting.expiresAt || (posting as any).expires_at;
  const timeRemaining = formatTimeRemaining(expiresAt);

  const rawPct = posting.matchPercentage ?? (posting as any).match_percentage;
  const matchPct =
    rawPct !== undefined && rawPct !== null
      ? Math.round(rawPct)
      : posting.semantic_match_score !== undefined
        ? Math.round(posting.semantic_match_score * 100)
        : (posting as any).semanticMatchScore !== undefined
          ? Math.round((posting as any).semanticMatchScore * 100)
          : posting.matchScore !== undefined
            ? Math.round(posting.matchScore * 100)
            : undefined;

  const matchedSkills =
    isMatchedTab &&
    ((posting as any).matchedSkills || (posting as any).matched_skills)
      ? (posting as any).matchedSkills || (posting as any).matched_skills
      : [];
  const matchedInterests =
    isMatchedTab &&
    ((posting as any).matchedInterests || (posting as any).matched_interests)
      ? (posting as any).matchedInterests || (posting as any).matched_interests
      : [];

  const matchedSkillIds = new Set(
    matchedSkills.map((s: any) =>
      typeof s === 'string' ? s : s.id || s.name
    )
  );
  const matchedInterestIds = new Set(
    matchedInterests.map((i: any) =>
      typeof i === 'string' ? i : i.id || i.name
    )
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back button navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary-600 transition-colors cursor-pointer group"
      >
        <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        <span>Back to Postings</span>
      </button>

      {/* Main Full-Page Posting Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-8">
        {/* Header Metadata */}
        <div className="space-y-3 border-b border-gray-100 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-md text-xs sm:text-sm">
              {groupName}
            </span>
            <span className="text-xs text-gray-400">
              • Posted {timeAgo(posting.createdAt || (posting as any).created_at)}
            </span>
            {!isSelfPost && matchPct !== undefined && (
              <span
                className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800 border border-primary-200"
                title={`${matchPct}% Skill Overlap`}
              >
                <span>{matchPct}% Skill Overlap</span>
              </span>
            )}
            {timeRemaining && (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 border border-orange-200">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Expires in {timeRemaining}</span>
              </span>
            )}
            {posting.pendingRequestCount !== undefined &&
              posting.pendingRequestCount > 0 && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  {posting.pendingRequestCount} pending request
                  {posting.pendingRequestCount > 1 ? 's' : ''}
                </span>
              )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {posting.title}
            </h1>

            {/* Actions top right */}
            <div className="shrink-0 flex items-center gap-3">
              {isSelfPost && onDeleteClick ? (
                <button
                  type="button"
                  onClick={onDeleteClick}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 shadow-sm transition-colors cursor-pointer"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span>Delete Posting</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onRequestClick}
                  disabled={hasRequested}
                  className={`inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold shadow-sm transition-all cursor-pointer ${
                    hasRequested
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {hasRequested ? (
                    <>
                      <CheckIcon className="h-4 w-4" />
                      <span>Request Sent</span>
                    </>
                  ) : (
                    <span>Request to Join</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            About the Project & Opportunity
          </h2>
          <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">
            {posting.description}
          </p>
        </div>

        {/* Roles Needed */}
        {rolesNeeded && rolesNeeded.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Roles Needed
            </h2>
            <div className="flex flex-wrap gap-2">
              {rolesNeeded.map((role: string) => (
                <TagChip key={role} label={role} variant="role" size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Skills Required */}
        {requiredSkills && requiredSkills.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Required Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {requiredSkills.map((skill: any) => {
                const skillName =
                  typeof skill === 'string' ? skill : skill.name;
                const skillId =
                  typeof skill === 'string' ? skill : skill.id || skill.name;
                return (
                  <TagChip
                    key={skillId}
                    label={skillName}
                    variant="skill"
                    size="md"
                    matched={
                      matchedSkillIds.has(skillId) ||
                      matchedSkillIds.has(skillName)
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Interests */}
        {requiredInterests && requiredInterests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Interests & Focus Areas
            </h2>
            <div className="flex flex-wrap gap-2">
              {requiredInterests.map((interest: any) => {
                const interestName =
                  typeof interest === 'string' ? interest : interest.name;
                const interestId =
                  typeof interest === 'string'
                    ? interest
                    : interest.id || interest.name;
                return (
                  <TagChip
                    key={interestId}
                    label={interestName}
                    variant="interest"
                    size="md"
                    matched={
                      matchedInterestIds.has(interestId) ||
                      matchedInterestIds.has(interestName)
                    }
                  />
                );
              })}
            </div>
          </div>
        )}


        {/* Bottom CTA Bar if not owner */}
        {!isSelfPost && !onDeleteClick && (
          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Interested in contributing to this group? Send a join request with a short note.
            </p>
            <button
              type="button"
              onClick={onRequestClick}
              disabled={hasRequested}
              className={`rounded-lg px-6 py-2.5 text-sm font-semibold shadow-sm transition-all cursor-pointer ${
                hasRequested
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {hasRequested ? 'Request Sent' : 'Request to Join'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
