import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { connectionsApi } from '../../api/connections';
import CompletenessBar from './CompletenessBar';
import { getInitials } from '../../lib/utils';
import toast from 'react-hot-toast';

interface ProfileHeaderProps {
  profile: any;
  isOwnProfile: boolean;
}

export default function ProfileHeader({ profile, isOwnProfile }: ProfileHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
    bio: profile.bio || '',
    yearOfStudy: profile.yearOfStudy ?? profile.year_of_study ?? 1,
    branch: profile.branch || '',
    lookingFor: profile.lookingFor || profile.looking_for || 'none',
  });

  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setIsEditing(false);
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => connectionsApi.sendRequest(profile.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Connection request sent');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to send connection request'),
  });

  const acceptMutation = useMutation({
    mutationFn: () => connectionsApi.accept(profile.connectionId || profile.connection_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Connection accepted');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to accept connection request'),
  });

  const declineMutation = useMutation({
    mutationFn: () => connectionsApi.decline(profile.connectionId || profile.connection_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Connection request declined');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to decline connection request'),
  });

  const removeMutation = useMutation({
    mutationFn: () => connectionsApi.remove(profile.connectionId || profile.connection_id || profile.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      toast.success('Connection removed');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to remove connection'),
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const displayName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Student';
  const connectionStatus = profile.connectionStatus || profile.connection_status || 'none';

  const getLookingForBadge = (val: string) => {
    switch (val) {
      case 'project': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Looking for Projects</span>;
      case 'event': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Looking for Events</span>;
      case 'both': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Open to Projects & Events</span>;
      default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Not looking right now</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="flex-shrink-0">
          {profile.avatarUrl || profile.avatar_url ? (
            <img src={profile.avatarUrl || profile.avatar_url} alt={displayName} className="h-24 w-24 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold border-2 border-primary-50">
              {getInitials(displayName)}
            </div>
          )}
        </div>
        
        <div className="flex-grow space-y-2 w-full">
          {isEditing ? (
            <div className="space-y-4 w-full">
              <div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Name"
                />
              </div>
              
              <div className="flex gap-4">
                <input
                  type="number"
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({...formData, yearOfStudy: parseInt(e.target.value, 10) || 1})}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-1/3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Year of Study"
                />
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({...formData, branch: e.target.value})}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-2/3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Branch/Major"
                />
              </div>
              
              <select
                value={formData.lookingFor}
                onChange={(e) => setFormData({...formData, lookingFor: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="none">Not looking right now</option>
                <option value="project">Looking for Projects</option>
                <option value="event">Looking for Events</option>
                <option value="both">Both</option>
              </select>

              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm h-20 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Write a short bio..."
              />
              
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
                  <p className="text-gray-500 text-sm mt-1">
                    {profile.college?.name || profile.collegeName || profile.college_name || 'College student'} {profile.city ? `• ${profile.city}` : ''}
                  </p>
                </div>
                {isOwnProfile ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    Edit Profile
                  </button>
                ) : connectionStatus === 'connected' ? (
                  <button onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending} className="bg-green-100 hover:bg-red-100 text-green-800 hover:text-red-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                    {removeMutation.isPending ? 'Disconnecting...' : 'Connected · Disconnect'}
                  </button>
                ) : connectionStatus === 'pending_sent' ? (
                  <span className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium">Request Sent</span>
                ) : connectionStatus === 'pending_received' ? (
                  <div className="flex gap-2">
                    <button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending || declineMutation.isPending} className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">Accept Request</button>
                    <button onClick={() => declineMutation.mutate()} disabled={acceptMutation.isPending || declineMutation.isPending} className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">Decline</button>
                  </div>
                ) : (
                  <button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending} className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50">
                    {connectMutation.isPending ? 'Sending...' : 'Connect'}
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {(profile.yearOfStudy || profile.year_of_study) && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    Year {profile.yearOfStudy || profile.year_of_study}
                  </span>
                )}
                {profile.branch && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    {profile.branch}
                  </span>
                )}
                {getLookingForBadge(profile.lookingFor || profile.looking_for || 'none')}
              </div>
              
              {profile.bio && (
                <p className="text-gray-700 text-sm mt-4 whitespace-pre-wrap">{profile.bio}</p>
              )}
            </>
          )}
        </div>
      </div>
      
      {isOwnProfile && (profile.profileCompleteness ?? profile.completeness) !== undefined && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <CompletenessBar score={profile.profileCompleteness ?? profile.completeness} />
        </div>
      )}
    </div>
  );
}
