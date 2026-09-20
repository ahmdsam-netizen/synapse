import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { groupsApi } from '../../api/groups';
import { Group } from '../../types';
import { UserGroupIcon } from '@heroicons/react/24/outline';

interface InviteToGroupModalProps {
  open: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  onSuccess?: () => void;
}

export function InviteToGroupModal({ open, onClose, targetUser, onSuccess }: InviteToGroupModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
    enabled: open,
  });

  const rawGroups: Group[] = Array.isArray((groupsData?.data as any)?.data)
    ? (groupsData?.data as any).data
    : Array.isArray(groupsData?.data)
      ? (groupsData?.data as any)
      : [];

  const adminGroups = rawGroups.filter(
    (g: any) => g.userRole === 'admin' || g.role === 'admin'
  );

  useEffect(() => {
    if (adminGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(adminGroups[0].id);
    }
  }, [adminGroups, selectedGroupId]);

  const inviteMutation = useMutation({
    mutationFn: () =>
      groupsApi.inviteMember(selectedGroupId, {
        userId: targetUser.id,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${targetUser.name}!`);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (onSuccess) onSuccess();
      handleClose();
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to send invitation'
      );
    },
  });

  const handleClose = () => {
    setNote('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      toast.error('Please select a group');
      return;
    }
    inviteMutation.mutate();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Invite ${targetUser.name} to Group`}>
      {isLoadingGroups ? (
        <div className="py-8 text-center text-sm text-gray-500">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent mb-2" />
          <p>Loading your managed groups...</p>
        </div>
      ) : adminGroups.length === 0 ? (
        <div className="py-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <UserGroupIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">No Admin Groups Found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You must be an admin of a group to send invitations. Create a group first from your homepage or group tab!
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Select Group *
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
            >
              {adminGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.memberCount || 1} members)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Invitation Note (Optional)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Hey! We saw your work on React and would love for you to join our team for the upcoming hackathon."
              className="block w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-400 text-right">
              {note.length} / 500
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending || !selectedGroupId}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
