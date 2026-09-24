import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { groupsApi } from '../../api/groups';
import { cn } from '../../lib/utils';

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
    maxMembers: 8,
    durationDays: 7,
  });

  const createGroupMutation = useMutation({
    mutationFn: () => groupsApi.create({ ...groupData, maxMembers: 8 }),
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
    setGroupData({ name: '', description: '', visibility: 'global', maxMembers: 8, durationDays: 7 });
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
    <Modal open={open} onClose={handleClose} title="Create New Group" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Group Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. AI Research Group, Hackathon Squad"
            className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
            value={groupData.name}
            onChange={(e) => setGroupData((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
          <textarea
            placeholder="Describe the group's mission, engineering goals, or project scope..."
            className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
            rows={3}
            value={groupData.description}
            onChange={(e) => setGroupData((prev) => ({ ...prev, description: e.target.value }))}
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

        <div className="mt-6 flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 focus:outline-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createGroupMutation.isPending}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
