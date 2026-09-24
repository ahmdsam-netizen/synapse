import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { groupsApi } from '../../api/groups';
import { boardsApi } from '../../api/boards';
import { cn } from '../../lib/utils';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  initialStep?: 1 | 2;
  existingGroupId?: string;
}

export function CreateGroupModal({ open, onClose, initialStep = 1, existingGroupId }: CreateGroupModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(existingGroupId || null);
  
  // Group Form State
  const [groupData, setGroupData] = useState({
    name: '',
    description: '',
    visibility: 'global' as 'global' | 'college',
    maxMembers: 8,
    durationDays: 7,
  });

  // Posting Form State
  const [postingData, setPostingData] = useState({
    title: '',
    description: '',
    rolesNeeded: '',
    requiredSkills: '',
    requiredInterests: '',
    community: 'project' as 'project' | 'hackathon' | 'competition',
  });

  const createGroupMutation = useMutation({
    mutationFn: () => groupsApi.create({ ...groupData, maxMembers: 8 }),
    onSuccess: (res) => {
      const gId = (res.data as any)?.group?.id || (res.data as any)?.id;
      setCreatedGroupId(gId);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setStep(2);
      toast.success('Group created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create group');
    },
  });

  const createPostingMutation = useMutation({
    mutationFn: () => {
      if (!createdGroupId) throw new Error('No group ID');
      return boardsApi.createPosting({
        groupId: createdGroupId,
        title: postingData.title,
        description: postingData.description,
        community: postingData.community,
        rolesNeeded: postingData.rolesNeeded.split(',').map(s => s.trim()).filter(Boolean),
        requiredSkillIds: postingData.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        requiredInterestIds: postingData.requiredInterests.split(',').map(s => s.trim()).filter(Boolean),
        slotsTotal: 1,
      });
    },
    onSuccess: () => {
      toast.success('Posting created successfully!');
      queryClient.invalidateQueries({ queryKey: ['board'] });
      queryClient.invalidateQueries({ queryKey: ['groups', createdGroupId] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create posting');
    },
  });

  const handleClose = () => {
    setStep(initialStep);
    setGroupData({ name: '', description: '', visibility: 'global', maxMembers: 8, durationDays: 7 });
    setPostingData({ title: '', description: '', rolesNeeded: '', requiredSkills: '', requiredInterests: '', community: 'project' });
    onClose();
  };

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupData.name) {
      toast.error('Group name is required');
      return;
    }
    createGroupMutation.mutate();
  };

  const handlePostingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postingData.title) {
      toast.error('Posting title is required');
      return;
    }
    createPostingMutation.mutate();
  };

  return (
    <Modal 
      open={open} 
      onClose={handleClose} 
      title={step === 1 ? 'Create New Group' : 'Create Group Posting'}
      size="lg"
    >
      {step === 1 && (
        <form onSubmit={handleGroupSubmit} className="space-y-5 p-1">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Group Name *</label>
            <input
              type="text"
              required
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={groupData.name}
              onChange={e => setGroupData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              rows={3}
              value={groupData.description}
              onChange={e => setGroupData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Visibility Selector Buttons */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Visibility *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGroupData((prev) => ({ ...prev, visibility: 'global' }))}
                className={cn(
                  "py-3 px-4 rounded-lg border text-sm font-semibold transition-colors cursor-pointer text-left flex flex-col justify-center",
                  groupData.visibility === 'global'
                    ? "bg-primary-50 border-primary-600 text-primary-900 shadow-xs"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <span>#global</span>
                <span className="text-[11px] font-normal text-gray-500 mt-0.5">Open to all verified colleges</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupData((prev) => ({ ...prev, visibility: 'college' }))}
                className={cn(
                  "py-3 px-4 rounded-lg border text-sm font-semibold transition-colors cursor-pointer text-left flex flex-col justify-center",
                  groupData.visibility === 'college'
                    ? "bg-primary-50 border-primary-600 text-primary-900 shadow-xs"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <span>#college</span>
                <span className="text-[11px] font-normal text-gray-500 mt-0.5">Restricted to your campus only</span>
              </button>
            </div>
          </div>

          {/* Duration Selector Buttons */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Duration *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { days: 1, label: '1 Day', sub: 'Flash' },
                { days: 7, label: '7 Days', sub: '1 Week' },
                { days: 15, label: '15 Days', sub: '2 Weeks' },
                { days: 30, label: '30 Days', sub: '1 Month' },
              ].map((d) => (
                <button
                  key={d.days}
                  type="button"
                  onClick={() => setGroupData((prev) => ({ ...prev, durationDays: d.days }))}
                  className={cn(
                    "py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer text-center flex flex-col items-center justify-center",
                    groupData.durationDays === d.days
                      ? "bg-primary-50 border-primary-600 text-primary-900 shadow-xs"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span>{d.label}</span>
                  <span className="text-[10px] font-normal text-gray-500 mt-0.5">{d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span>Capacity: <strong>Max 8 members</strong></span>
            <span>Expires after: <strong>{groupData.durationDays} day{groupData.durationDays > 1 ? 's' : ''}</strong></span>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createGroupMutation.isPending}
              className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
            >
              {createGroupMutation.isPending ? 'Creating...' : 'Next'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handlePostingSubmit} className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Posting Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Seeking Full-Stack Developer for EdTech Startup"
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={postingData.title}
              onChange={e => setPostingData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              rows={2}
              value={postingData.description}
              onChange={e => setPostingData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Roles Needed (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Frontend Developer, Designer"
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={postingData.rolesNeeded}
              onChange={e => setPostingData(prev => ({ ...prev, rolesNeeded: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Required Skills</label>
              <input
                type="text"
                placeholder="e.g. React, Node.js"
                className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
                value={postingData.requiredSkills}
                onChange={e => setPostingData(prev => ({ ...prev, requiredSkills: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Required Interests</label>
              <input
                type="text"
                placeholder="e.g. AI, Web3"
                className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
                value={postingData.requiredInterests}
                onChange={e => setPostingData(prev => ({ ...prev, requiredInterests: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 cursor-pointer"
            >
              Skip for now
            </button>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createPostingMutation.isPending}
                className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 disabled:opacity-50 cursor-pointer"
              >
                {createPostingMutation.isPending ? 'Creating...' : 'Create Posting'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
