import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { communitiesApi } from '../../api/communities';
import { GlobeAltIcon, UsersIcon, ShieldCheckIcon, ClockIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface CreateCommunityModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (communityId: string) => void;
}

export function CreateCommunityModal({ open, onClose, onSuccess }: CreateCommunityModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'permanent' | 'temporary'>('permanent');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [maxMembers, setMaxMembers] = useState<number>(1000);

  const createMutation = useMutation({
    mutationFn: () =>
      communitiesApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        durationDays: type === 'temporary' ? durationDays : null,
        maxMembers: Number(maxMembers) || 1000,
      }),
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
    setType('permanent');
    setDurationDays(30);
    setMaxMembers(1000);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Community name is required');
      return;
    }
    const parsedLimit = Number(maxMembers);
    if (!parsedLimit || parsedLimit < 2 || parsedLimit > 1000) {
      toast.error('Member limit must be between 2 and 1,000 members');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create New Community" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 p-1">
        {/* Info Section */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3.5 text-xs text-gray-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-gray-900">
            <InformationCircleIcon className="h-4 w-4 text-primary-700" />
            <span>Community Information</span>
          </div>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Global Reach</strong>: Open to verified student peers across all institutions.</li>
            <li><strong>Duration Types</strong>: Communities can be permanent or temporary.</li>
            <li><strong>Member Limits</strong>: Set any custom member limit up to 1,000. In this platform, there could be at max thousand members in a community.</li>
            <li><strong>Board Postings</strong>: Community admins can create recruitment postings on the board to invite verified peers.</li>
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
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Community Type (Permanent vs Temporary) */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1.5">Community Duration</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('permanent')}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer ${
                type === 'permanent'
                  ? 'border-primary-600 bg-primary-50 text-primary-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ShieldCheckIcon className="h-4 w-4 text-primary-700" />
              <span>Permanent (No Expiration)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('temporary')}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer ${
                type === 'temporary'
                  ? 'border-primary-600 bg-primary-50 text-primary-900'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClockIcon className="h-4 w-4 text-primary-700" />
              <span>Temporary (Set Duration)</span>
            </button>
          </div>
        </div>

        {/* Duration input if temporary */}
        {type === 'temporary' && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Active Duration (Days) *</label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm cursor-pointer"
            >
              <option value={7}>7 Days (1 Week)</option>
              <option value={14}>14 Days (2 Weeks)</option>
              <option value={30}>30 Days (1 Month)</option>
              <option value={60}>60 Days (2 Months)</option>
              <option value={90}>90 Days (3 Months)</option>
              <option value={180}>180 Days (6 Months)</option>
              <option value={365}>365 Days (1 Year)</option>
            </select>
          </div>
        )}

        {/* Member Limit */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1">Member Limit</label>
          <input
            type="number"
            min={2}
            max={1000}
            value={maxMembers}
            onChange={(e) => setMaxMembers(Number(e.target.value))}
            placeholder="Enter member capacity (up to 1,000)"
            className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Set custom member limit. There could be at max thousand members.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center text-xs pt-1">
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <GlobeAltIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            <span className="font-semibold text-gray-900 block">Global</span>
            <span className="text-gray-500 text-[10px]">All Institutions</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            {type === 'permanent' ? (
              <ShieldCheckIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            ) : (
              <ClockIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            )}
            <span className="font-semibold text-gray-900 block capitalize">{type}</span>
            <span className="text-gray-500 text-[10px]">{type === 'temporary' ? `${durationDays} Days` : 'No Expiry'}</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-2.5">
            <UsersIcon className="mx-auto h-4 w-4 text-primary-600 mb-1" />
            <span className="font-semibold text-gray-900 block">{maxMembers || 1000} Capacity</span>
            <span className="text-gray-500 text-[10px]">Member Limit</span>
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
