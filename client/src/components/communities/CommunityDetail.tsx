import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop, TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import { XMarkIcon, TrashIcon, GlobeAltIcon, UsersIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { communitiesApi } from '../../api/communities';
import { groupsApi } from '../../api/groups';
import { MemberList } from '../groups/MemberList';
import { GroupChat } from '../chat/GroupChat';
import { Modal } from '../shared/Modal';

interface CommunityDetailProps {
  communityId: string;
  onClose: () => void;
}

export function CommunityDetail({ communityId, onClose }: CommunityDetailProps) {
  const queryClient = useQueryClient();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);

  const { data: commData, isPending } = useQuery({
    queryKey: ['communities', communityId],
    queryFn: () => communitiesApi.getDetail(communityId),
    enabled: !!communityId,
  });

  const community: any = (commData?.data as any)?.data || commData?.data;
  const currentUserRole = community?.viewerRole || (community?.members || []).find((m: any) => m.id === community?.viewerId)?.role;
  const isMember = community?.isMember ?? !!currentUserRole;
  const memberCount = community?.memberCount ?? community?.members?.length ?? 1;

  const joinMutation = useMutation({
    mutationFn: () => communitiesApi.join(communityId),
    onSuccess: () => {
      toast.success('Joined community successfully!');
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'me'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to join community');
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => communitiesApi.leave(communityId),
    onSuccess: () => {
      toast.success('Left community');
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'me'] });
      setIsConfirmLeaveOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to leave community');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => communitiesApi.deleteCommunity(communityId),
    onSuccess: () => {
      toast.success('Community deleted');
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'me'] });
      setIsConfirmDeleteOpen(false);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete community');
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.promoteMember(communityId, userId),
    onSuccess: () => {
      toast.success('Member promoted to admin');
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
    },
    onError: () => toast.error('Failed to promote member'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(communityId, userId),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
    onError: () => toast.error('Failed to remove member'),
  });

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/50 transition-opacity" />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <DialogPanel className="pointer-events-auto w-screen max-w-2xl transform transition data-[closed]:translate-x-full data-[enter]:duration-500 data-[leave]:duration-500 data-[enter]:ease-in-out data-[leave]:ease-in-out">
              <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                <div className="px-4 py-6 sm:px-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <DialogTitle className="text-xl font-semibold leading-6 text-gray-900">
                        {isPending ? 'Loading...' : community?.name}
                      </DialogTitle>
                      <p className="mt-1 text-xs text-gray-500">
                        Permanent Global Student Community
                      </p>
                    </div>

                    <div className="ml-3 flex h-7 items-center gap-2">
                      {currentUserRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => setIsConfirmDeleteOpen(true)}
                          title="Delete Community"
                          className="rounded-md p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none transition-colors cursor-pointer"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none cursor-pointer"
                        onClick={onClose}
                      >
                        <span className="sr-only">Close panel</span>
                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {!isPending && community && (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          <GlobeAltIcon className="h-3.5 w-3.5 text-gray-500" />
                          Global
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-800 border border-primary-200">
                          <ShieldCheckIcon className="h-3.5 w-3.5 text-primary-600" />
                          Permanent
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <UsersIcon className="h-3.5 w-3.5 text-gray-400" />
                          {memberCount} / 1000 Members
                        </span>
                      </div>

                      <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                        {community.description || 'No description provided.'}
                      </p>

                      <div className="mt-4 flex items-center gap-3 pt-2">
                        {isMember ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800 border border-primary-200">
                              {currentUserRole === 'admin' ? 'Community Admin' : 'Member'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsConfirmLeaveOpen(true)}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              Leave Community
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => joinMutation.mutate()}
                            disabled={joinMutation.isPending || memberCount >= 1000}
                            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {joinMutation.isPending
                              ? 'Joining...'
                              : memberCount >= 1000
                              ? 'Community Full'
                              : 'Join Community'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {!isPending && community && (
                  <TabGroup className="flex flex-1 flex-col">
                    <div className="border-b border-gray-200 px-4 sm:px-6">
                      <TabList className="-mb-px flex space-x-8">
                        {['Members', 'Chat'].map((tab) => (
                          <Tab
                            key={tab}
                            className="whitespace-nowrap border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 data-[selected]:border-primary-500 data-[selected]:text-primary-600 outline-none cursor-pointer"
                          >
                            {tab}
                          </Tab>
                        ))}
                      </TabList>
                    </div>

                    <TabPanels className="flex-1 overflow-y-auto p-4 sm:p-6">
                      <TabPanel>
                        <MemberList
                          members={community.members || []}
                          currentUserRole={currentUserRole}
                          onPromote={(userId) => promoteMutation.mutate(userId)}
                          onRemove={(userId) => removeMutation.mutate(userId)}
                        />
                      </TabPanel>

                      <TabPanel>
                        <GroupChat
                          groupId={communityId}
                          isMember={isMember}
                          groupName={community?.name}
                        />
                      </TabPanel>
                    </TabPanels>
                  </TabGroup>
                )}
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>

      {isConfirmDeleteOpen && (
        <Modal
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Delete Community"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{community?.name}</span>? All
              members and community records will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Community'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isConfirmLeaveOpen && (
        <Modal
          open={isConfirmLeaveOpen}
          onClose={() => setIsConfirmLeaveOpen(false)}
          title="Leave Community"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to leave <span className="font-semibold text-gray-900">{community?.name}</span>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmLeaveOpen(false)}
                disabled={leaveMutation.isPending}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => leaveMutation.mutate()}
                disabled={leaveMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {leaveMutation.isPending ? 'Leaving...' : 'Leave Community'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Dialog>
  );
}
