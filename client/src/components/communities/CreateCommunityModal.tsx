import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { communitiesApi } from '../../api/communities';
import { GlobeAltIcon, UsersIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface CreateCommunityModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (communityId: string) => void;
}

export function CreateCommunityModal({ open, onClose, onSuccess }: CreateCommunityModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: () => communitiesApi.create({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (res) => {
      const commId = (res.data as any)?.id;
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'me'] });
      toast.success('Community created successfully!');
      handleClose();
      if (onSuccess && commId) {
        onSuccess(commId);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create community');
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Community name is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create New Community" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3.5 text-xs text-gray-600 space-y-1.5">
          <p className="font-semibold text-gray-800">About Communities:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Global Visibility</strong>: Open to verified student peers across all institutions.</li>
            <li><strong>Permanent</strong>: Never expires (no expiration time limit).</li>
            <li><strong>1,000 Member Limit</strong>: Supports large-scale interest groups and societies.</li>
            <li><strong>No Posters</strong>: Community recruitment posters are not created on the board.</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Community Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Distributed Systems Lab, Robotics & AI Club, Web3 Builders"
            className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
          <textarea
            placeholder="Describe the community's theme, objectives, focus areas, and guidelines..."
            className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <GlobeAltIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            <span className="font-semibold text-gray-900 block">Global</span>
            <span className="text-gray-500 text-[10px]">All Institutions</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <ShieldCheckIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            <span className="font-semibold text-gray-900 block">Permanent</span>
            <span className="text-gray-500 text-[10px]">No Expiration</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <UsersIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            <span className="font-semibold text-gray-900 block">1,000 Users</span>
            <span className="text-gray-500 text-[10px]">Capacity Limit</span>
          </div>
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
            disabled={createMutation.isPending}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 focus:outline-none disabled:opacity-50 cursor-pointer"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Community'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
