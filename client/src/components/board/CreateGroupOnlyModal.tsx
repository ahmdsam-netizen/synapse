import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { groupsApi } from '../../api/groups';

interface CreateGroupOnlyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

export function CreateGroupOnlyModal({ open, onClose, onSuccess }: CreateGroupOnlyModalProps) {
  const queryClient = useQueryClient();
  const [groupData, setGroupData] = useState({
    name: '',
    description: '',
    visibility: 'global' as 'global' | 'college',
    maxMembers: 5,
  });

  const createGroupMutation = useMutation({
    mutationFn: () => groupsApi.create(groupData),
    onSuccess: (res) => {
      const gId = (res.data as any)?.data?.id || (res.data as any)?.group?.id || (res.data as any)?.id;
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'me'] });
      toast.success('Group created successfully!');
      handleClose();
      if (onSuccess && gId) {
        onSuccess(gId);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create group');
    },
  });

  const handleClose = () => {
    setGroupData({ name: '', description: '', visibility: 'global', maxMembers: 5 });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupData.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    createGroupMutation.mutate();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create New Group" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">Group Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. AI Research Group, Hackathon Squad"
            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
            value={groupData.name}
            onChange={(e) => setGroupData((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">Description</label>
          <textarea
            placeholder="Describe the group's mission, goals, or current projects..."
            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
            rows={3}
            value={groupData.description}
            onChange={(e) => setGroupData((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900">Visibility</label>
            <select
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm bg-white"
              value={groupData.visibility}
              onChange={(e) => setGroupData((prev) => ({ ...prev, visibility: e.target.value as 'global' | 'college' }))}
            >
              <option value="global">Global (All Colleges)</option>
              <option value="college">College Only</option>
            </select>
          </div>

          <div className="w-1/3">
            <label className="block text-sm font-medium text-gray-900">Max Members</label>
            <input
              type="number"
              min="2"
              max="100"
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
              value={groupData.maxMembers}
              onChange={(e) => setGroupData((prev) => ({ ...prev, maxMembers: parseInt(e.target.value) || 5 }))}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createGroupMutation.isPending}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none disabled:opacity-50"
          >
            {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
