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
    maxMembers: 5,
  });

  // Posting Form State
  const [postingData, setPostingData] = useState({
    title: '',
    description: '',
    rolesNeeded: '',
    requiredSkills: '',
    requiredInterests: '',
    slotsTotal: 1,
  });

  const createGroupMutation = useMutation({
    mutationFn: () => groupsApi.create(groupData),
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
        rolesNeeded: postingData.rolesNeeded.split(',').map(s => s.trim()).filter(Boolean),
        requiredSkillIds: [],
        requiredInterestIds: [],
        slotsTotal: Number(postingData.slotsTotal) || 5,
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
    setGroupData({ name: '', description: '', visibility: 'global', maxMembers: 5 });
    setPostingData({ title: '', description: '', rolesNeeded: '', requiredSkills: '', requiredInterests: '', slotsTotal: 1 });
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
      size="md"
    >
      {step === 1 && (
        <form onSubmit={handleGroupSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">Group Name *</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              value={groupData.name}
              onChange={e => setGroupData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Description</label>
            <textarea
              className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              rows={3}
              value={groupData.description}
              onChange={e => setGroupData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900">Visibility</label>
              <select
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3 bg-white"
                value={groupData.visibility}
                onChange={e => setGroupData(prev => ({ ...prev, visibility: e.target.value as 'global' | 'college' }))}
              >
                <option value="global">Global</option>
                <option value="college">College</option>
              </select>
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-900">Max Members</label>
              <input
                type="number"
                min="2"
                max="100"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
                value={groupData.maxMembers}
                onChange={e => setGroupData(prev => ({ ...prev, maxMembers: parseInt(e.target.value) || 5 }))}
              />
            </div>
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
        <form onSubmit={handlePostingSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900">Posting Title *</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              value={postingData.title}
              onChange={e => setPostingData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Description</label>
            <textarea
              className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              rows={2}
              value={postingData.description}
              onChange={e => setPostingData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Roles Needed (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Frontend Developer, Designer"
              className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              value={postingData.rolesNeeded}
              onChange={e => setPostingData(prev => ({ ...prev, rolesNeeded: e.target.value }))}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900">Required Skills</label>
              <input
                type="text"
                placeholder="e.g. React, Node.js"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
                value={postingData.requiredSkills}
                onChange={e => setPostingData(prev => ({ ...prev, requiredSkills: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900">Required Interests</label>
              <input
                type="text"
                placeholder="e.g. AI, Web3"
                className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
                value={postingData.requiredInterests}
                onChange={e => setPostingData(prev => ({ ...prev, requiredInterests: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900">Total Slots to Fill</label>
            <input
              type="number"
              min="1"
              className="mt-1 block w-1/3 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 px-3"
              value={postingData.slotsTotal}
              onChange={e => setPostingData(prev => ({ ...prev, slotsTotal: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900"
            >
              Skip for now
            </button>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createPostingMutation.isPending}
                className="rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50"
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
