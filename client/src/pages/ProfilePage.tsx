import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import ProfileHeader from '../components/profile/ProfileHeader';
import SkillEditor from '../components/profile/SkillEditor';
import InterestEditor from '../components/profile/InterestEditor';
import WorkItemCard from '../components/profile/WorkItemCard';
import WorkItemForm from '../components/profile/WorkItemForm';
import { UserProfile } from '../types';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [isWorkItemFormOpen, setIsWorkItemFormOpen] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState<any>(null);

  const isOwnProfile = !id || id === 'me' || id === user?.id;
  const profileId = isOwnProfile ? 'me' : id;

  const { data: responseData, isPending, error } = useQuery({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      const res = isOwnProfile ? await usersApi.getMe() : await usersApi.getProfile(profileId as string);
      return res.data;
    },
  });

  const profile: UserProfile | undefined = (responseData as any)?.user || (responseData as any)?.data || responseData;

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold text-gray-800">Profile not found</h2>
        <p className="text-gray-600 mt-2">The user you are looking for does not exist or has been removed.</p>
      </div>
    );
  }

  const workItems = profile.workItems || (profile as any).work_items || [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <ProfileHeader profile={profile} isOwnProfile={isOwnProfile} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-8">
          <SkillEditor skills={profile.skills || []} isOwnProfile={isOwnProfile} />
          <InterestEditor interests={profile.interests || []} isOwnProfile={isOwnProfile} />
        </div>
        
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Work & Projects</h3>
              {isOwnProfile && (
                <button
                  onClick={() => {
                    setEditingWorkItem(null);
                    setIsWorkItemFormOpen(true);
                  }}
                  className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                >
                  Add Project
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              {workItems.length === 0 ? (
                <p className="text-gray-500 text-sm">No work items or projects added yet.</p>
              ) : (
                workItems.map((item: any) => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    isOwnProfile={isOwnProfile}
                    onEdit={() => {
                      setEditingWorkItem(item);
                      setIsWorkItemFormOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isWorkItemFormOpen && (
        <WorkItemForm
          isOpen={isWorkItemFormOpen}
          onClose={() => {
            setIsWorkItemFormOpen(false);
            setEditingWorkItem(null);
          }}
          initialData={editingWorkItem}
        />
      )}
    </div>
  );
}
