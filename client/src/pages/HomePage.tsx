import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { groupsApi } from '../api/groups';
import { boardsApi } from '../api/boards';
import { GroupCard } from '../components/shared/GroupCard';
import { EmptyState } from '../components/shared/EmptyState';
import { StatusBadge } from '../components/shared/StatusBadge';
import { timeAgo, getInitials } from '../lib/utils';
import { CreateGroupOnlyModal } from '../components/board/CreateGroupOnlyModal';
import { GroupDetail } from '../components/groups/GroupDetail';
import { Group, JoinRequest, GroupInvite } from '../types';

export default function HomePage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);

  const { data: groupsData, isPending: isLoadingGroups } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
  });

  const { data: requestsData, isPending: isLoadingRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => boardsApi.getMyRequests(),
  });

  const { data: invitesData, isPending: isLoadingInvites } = useQuery({
    queryKey: ['group-invites', 'me'],
    queryFn: () => groupsApi.getMyInvites(),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (inviteId: string) => groupsApi.acceptInvite(inviteId),
    onSuccess: () => {
      toast.success('Joined group successfully!');
      queryClient.invalidateQueries({ queryKey: ['group-invites', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to accept invitation');
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: (inviteId: string) => groupsApi.declineInvite(inviteId),
    onSuccess: () => {
      toast.success('Invitation declined');
      queryClient.invalidateQueries({ queryKey: ['group-invites', 'me'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to decline invitation');
    },
  });

  const groups: Group[] = Array.isArray((groupsData?.data as any)?.data)
    ? (groupsData?.data as any).data
    : Array.isArray(groupsData?.data)
      ? (groupsData?.data as any)
      : [];
  const requests: JoinRequest[] = Array.isArray((requestsData?.data as any)?.data)
    ? (requestsData?.data as any).data
    : Array.isArray(requestsData?.data)
      ? (requestsData?.data as any)
      : [];
  const invites: GroupInvite[] = Array.isArray((invitesData?.data as any)?.data)
    ? (invitesData?.data as any).data
    : Array.isArray(invitesData?.data)
      ? (invitesData?.data as any)
      : [];

  const pendingInvitesCount = invites.filter((i) => i.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#myGroups</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your active collaborations</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Create Group
        </button>
      </div>

      {isLoadingGroups ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group: Group) => (
            <GroupCard
              key={group.id}
              group={group}
              role={group.userRole || (group as any).role}
              onClick={() => setSelectedGroupId(group.id)}
              pendingRequestsCount={group.pendingRequestCount || parseInt((group as any).pending_request_count || '0', 10)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="You haven't joined any groups yet"
          description="Find a project that matches your skills or create your own group to get started."
          action={{
            label: 'Browse Board',
            onClick: () => window.location.href = '/boards',
          }}
        />
      )}

      {/* Group Invitations Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">#groupInvites</h2>
            <p className="mt-1 text-sm text-gray-500">Invitations received from group admins to join their teams</p>
          </div>
          {pendingInvitesCount > 0 && (
            <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
              {pendingInvitesCount} pending
            </span>
          )}
        </div>

        {isLoadingInvites ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : invites.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-200">
              {invites.map((invite) => (
                <li key={invite.id} className="p-4 sm:p-6 hover:bg-gray-50/60 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-semibold text-gray-900 truncate">
                          {invite.groupName}
                        </h4>
                        <StatusBadge
                          status={invite.status === 'pending' ? 'pending' : invite.status === 'accepted' ? 'approved' : 'rejected'}
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                        {invite.inviterAvatarUrl ? (
                          <img
                            src={invite.inviterAvatarUrl}
                            alt={invite.inviterName}
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-primary-100 text-primary-700 text-[10px] flex items-center justify-center font-bold">
                            {getInitials(invite.inviterName || 'Admin')}
                          </div>
                        )}
                        <span>
                          Invited by <span className="font-medium text-gray-700">{invite.inviterName}</span>
                        </span>
                        {invite.collegeName && (
                          <>
                            <span>•</span>
                            <span>{invite.collegeName}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{timeAgo(invite.createdAt)}</span>
                      </div>

                      {invite.groupDescription && (
                        <p className="text-xs text-gray-500 line-clamp-1">{invite.groupDescription}</p>
                      )}

                      {invite.note && (
                        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200/70 px-3 py-2 text-xs text-amber-900">
                          <span className="font-semibold text-amber-800">Note: </span>
                          <span className="italic">"{invite.note}"</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {invite.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => acceptInviteMutation.mutate(invite.id)}
                            disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                            className="inline-flex items-center rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {acceptInviteMutation.isPending ? 'Joining...' : 'Accept & Join'}
                          </button>
                          <button
                            onClick={() => declineInviteMutation.mutate(invite.id)}
                            disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 capitalize">
                          {invite.status}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">No group invitations yet.</p>
            <p className="text-xs text-gray-400 mt-1">When group admins invite you to join their projects, they'll appear here.</p>
          </div>
        )}
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-xl font-bold text-gray-900">#myJoinRequests</h2>
        {isLoadingRequests ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : requests.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-200">
              {requests.map((request: any) => (
                <li key={request.id} className="p-4 hover:bg-gray-50 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {request.postingTitle || request.posting_title || request.posting?.title || 'Group Membership'}
                      </h4>
                      <p className="mt-1 text-sm text-gray-500">
                        Group: <span className="font-medium text-gray-700">{request.groupName || request.group_name || request.group?.name || 'Group'}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge 
                        status={request.status === 'pending' ? 'pending' : request.status === 'approved' ? 'approved' : 'rejected'} 
                      />
                      <span className="text-xs text-gray-400">
                        {timeAgo(request.createdAt || request.created_at)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">No outgoing join requests.</p>
          </div>
        )}
      </div>

      <CreateGroupOnlyModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {selectedGroupId && (
        <GroupDetail
          groupId={selectedGroupId}
          onClose={() => setSelectedGroupId(null)}
        />
      )}
    </div>
  );
}
