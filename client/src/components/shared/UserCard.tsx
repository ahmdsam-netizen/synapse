import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RecommendedUser } from '../../types';
import { connectionsApi } from '../../api/connections';
import { getInitials, cn } from '../../lib/utils';
import { TagChip } from './TagChip';
import toast from 'react-hot-toast';
import { UserPlusIcon, CheckIcon } from '@heroicons/react/24/outline';

interface UserCardProps {
  user: RecommendedUser;
  mode: 'similarity' | 'second_degree' | 'search';
  onConnect?: (userId: string) => void;
}

export function UserCard({ user, mode, onConnect }: UserCardProps) {
  const queryClient = useQueryClient();
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'requested' | 'error'>('idle');

  const handleConnect = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (requestStatus === 'requested' || requestStatus === 'loading') return;
    
    setRequestStatus('loading');
    try {
      await connectionsApi.sendRequest(user.id);
      setRequestStatus('requested');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Connection request sent!');
      if (onConnect) onConnect(user.id);
    } catch (error) {
      setRequestStatus('error');
      toast.error('Failed to send connection request.');
      // Revert after a short delay
      setTimeout(() => setRequestStatus('idle'), 2000);
    }
  };

  const displaySkills = user.skills || (user as any).allSkills || (user as any).all_skills || [];
  const college = user.collegeName || (user as any).college_name || (user as any).college?.name || 'Campus Connect Member';
  const year = user.yearOfStudy || user.year || (user as any).year_of_study || '1';

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow h-full">
      <Link to={`/profile/${user.id}`} className="flex-1 p-5 flex flex-col group cursor-pointer block">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {user.avatarUrl ? (
              <img 
                src={user.avatarUrl} 
                alt={user.name} 
                className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-medium text-lg ring-2 ring-gray-100">
                {getInitials(user.name)}
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 text-base group-hover:text-primary-600 transition-colors">
                {user.name}
              </h3>
              <p className="text-sm text-gray-500">
                {college} • Year {year}
              </p>
            </div>
          </div>
        </div>

        {user.lookingFor && (
          <div className="mb-4">
            <TagChip 
              label={`Looking for: ${user.lookingFor}`} 
              variant="status" 
              size="sm" 
            />
          </div>
        )}

        <div className="flex-1">
          {displaySkills && displaySkills.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Skills</p>
              <div className="flex flex-wrap gap-1.5 max-h-[60px] overflow-hidden relative">
                {displaySkills.slice(0, 5).map((skill: any, idx: number) => {
                  const sName = typeof skill === 'string' ? skill : skill.name;
                  const sId = typeof skill === 'string' ? skill : skill.id || skill.name;
                  const isMatched = (user.matchedSkills || []).some((ms: any) => ms.id === sId || ms.name === sName);
                  return (
                    <TagChip 
                      key={idx} 
                      label={sName} 
                      variant="skill" 
                      size="sm" 
                      matched={isMatched}
                    />
                  );
                })}
                {displaySkills.length > 5 && (
                  <div className="text-xs text-gray-400 self-center pl-1">
                    +{displaySkills.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-50 min-h-[40px] flex items-center">
          {mode === 'second_degree' && user.mutualCount !== undefined && (
            <div className="flex items-center text-xs text-gray-500">
              <div className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium mr-2">
                {user.mutualCount} mutual
              </div>
              {(user.viaConnection?.name || user.viaConnectionName) && (
                <span className="truncate">via {user.viaConnection?.name || user.viaConnectionName}</span>
              )}
            </div>
          )}
          
          {mode === 'similarity' && user.sameCollege && (
            <div className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium inline-block">
              Same college
            </div>
          )}
          
          {mode === 'search' && user.matchScore !== undefined && (
            <div className="text-xs text-gray-500">
              Match score: {Math.round(user.matchScore * 100)}%
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 pt-0">
        <button
          onClick={handleConnect}
          disabled={requestStatus === 'requested' || requestStatus === 'loading'}
          className={cn(
            "w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200",
            requestStatus === 'requested' 
              ? "bg-gray-100 text-gray-500 cursor-not-allowed" 
              : "bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow active:scale-[0.98]"
          )}
        >
          {requestStatus === 'requested' ? (
            <>
              <CheckIcon className="w-4 h-4 mr-2" />
              Requested
            </>
          ) : requestStatus === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <UserPlusIcon className="w-4 h-4 mr-2" />
              Connect
            </>
          )}
        </button>
      </div>
    </div>
  );
}
