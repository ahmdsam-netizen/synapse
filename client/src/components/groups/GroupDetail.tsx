import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop, TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import { XMarkIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { groupsApi } from '../../api/groups';
import { StatusBadge } from '../shared/StatusBadge';
import { MemberList } from './MemberList';
import { AdminRequestQueue } from '../board/AdminRequestQueue';
import { ChatPlaceholder } from './ChatPlaceholder';
import { CreatePostingOnlyModal } from '../board/CreatePostingOnlyModal';
import { Modal } from '../shared/Modal';
import { cn, formatTimeRemaining } from '../../lib/utils';

interface GroupDetailProps {
  groupId: string;
  onClose: () => void;
}

export function GroupDetail({ groupId, onClose }: GroupDetailProps) {
  const queryClient = useQueryClient();
  const [isCreatePostingOpen, setIsCreatePostingOpen] = useState(false);

  const { data: groupData, isPending } = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.getDetail(groupId),
    enabled: !!groupId,
  });

  const promoteMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.promoteMember(groupId, userId),
    onSuccess: () => {
      toast.success('Member promoted to admin');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
    onError: () => toast.error('Failed to promote member'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(groupId, userId),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.deleteGroup(groupId),
    onSuccess: () => {
      toast.success('Group deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
      setIsConfirmDeleteOpen(false);
      onClose();
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to delete group'
      );
    },
  });

  const groupDetail: any = (groupData?.data as any)?.data || (groupData?.data as any)?.group || groupData?.data;
  const currentUserRole = groupDetail?.viewerRole || groupDetail?.userRole || (groupDetail?.members || []).find((m: any) => m.id === groupDetail?.viewerId)?.role;
  const memberCount = groupDetail?.memberCount ?? groupDetail?.member_count ?? groupDetail?.members?.length ?? 0;
  const maxMembers = groupDetail?.maxMembers ?? groupDetail?.max_members;
  const pendingRequests = groupDetail?.pendingRequestCount ?? groupDetail?.pending_request_count ?? 0;
  const timeLeft = formatTimeRemaining(groupDetail?.expiresAt || groupDetail?.expires_at);

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
                    <DialogTitle className="text-xl font-semibold leading-6 text-gray-900">
                      {isPending ? 'Loading...' : groupDetail?.name}
                    </DialogTitle>
                    <div className="ml-3 flex h-7 items-center gap-2">
                      {currentUserRole === 'admin' && (
                        <button
                          type="button"
                          onClick={() => setIsConfirmDeleteOpen(true)}
                          title="Delete Group"
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
                  
                  {!isPending && groupDetail && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={groupDetail.status === 'open' ? 'open' : 'closed'}
                      />
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {groupDetail.visibility}
                      </span>
                      {timeLeft && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            timeLeft === 'Expired'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          )}
                        >
                          <ClockIcon className="h-3.5 w-3.5" />
                          {timeLeft}
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {memberCount} {maxMembers ? `/ ${maxMembers}` : ''} Members
                      </span>
                    </div>
                  )}
                  
                  {!isPending && groupDetail && (
                    <p className="mt-4 text-sm text-gray-600">{groupDetail.description}</p>
                  )}
                </div>

                {!isPending && groupDetail && (
                  <TabGroup className="flex flex-1 flex-col">
                    <div className="border-b border-gray-200 px-4 sm:px-6">
                      <TabList className="-mb-px flex space-x-8">
                        {['Members', 'Postings', ...(currentUserRole === 'admin' ? ['Requests'] : []), 'Chat'].map((tab) => (
                          <Tab
                            key={tab}
                            className="whitespace-nowrap border-b-2 border-transparent px-1 py-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 data-[selected]:border-primary-500 data-[selected]:text-primary-600 outline-none"
                          >
                            {tab}
                            {tab === 'Requests' && pendingRequests > 0 && (
                              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                                {pendingRequests}
                              </span>
                            )}
                          </Tab>
                        ))}
                      </TabList>
                    </div>
                    
                    <TabPanels className="flex-1 overflow-y-auto p-4 sm:p-6">
                      <TabPanel>
                        <MemberList
                          members={groupDetail.members || []}
                          currentUserRole={currentUserRole}
                          onPromote={(userId) => promoteMutation.mutate(userId)}
                          onRemove={(userId) => removeMutation.mutate(userId)}
                        />
                      </TabPanel>
                      
                      <TabPanel>
                        <div className="space-y-4">
                          {currentUserRole === 'admin' && (
                            <button
                              onClick={() => setIsCreatePostingOpen(true)}
                              className="w-full rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
                            >
                              + Create New Posting
                            </button>
                          )}
                          {(groupDetail.openPostings || groupDetail.postings || []).map((p: any) => (
                            <div key={p.id} className="rounded-lg border border-gray-200 p-4">
                              <h4 className="font-semibold">{p.title}</h4>
                              <p className="text-sm text-gray-600">{p.description}</p>
                            </div>
                          ))}
                          {!(groupDetail.openPostings || groupDetail.postings || [])?.length && (
                            <p className="text-sm text-gray-500 text-center py-4">No active postings.</p>
                          )}
                        </div>
                      </TabPanel>

                      {currentUserRole === 'admin' && (
                        <TabPanel>
                          <AdminRequestQueue groupId={groupId} />
                        </TabPanel>
                      )}

                      <TabPanel>
                        <ChatPlaceholder />
                      </TabPanel>
                    </TabPanels>
                  </TabGroup>
                )}
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>

      {isCreatePostingOpen && (
        <CreatePostingOnlyModal
          open={isCreatePostingOpen}
          onClose={() => setIsCreatePostingOpen(false)}
          initialGroupId={groupId}
        />
      )}

      {isConfirmDeleteOpen && (
        <Modal
          open={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Delete Group"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">{groupDetail?.name}</span>? All
              members, active postings, and invitations will be permanently removed. This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                disabled={deleteMutation.isPending}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 cursor-pointer"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Dialog>
  );
}
