import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  EnvelopeIcon,
  ClipboardDocumentCheckIcon,
  UserPlusIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { groupsApi } from '../api/groups';
import { boardsApi } from '../api/boards';
import { connectionsApi } from '../api/connections';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/shared/StatusBadge';
import { PageTabButton } from '../components/shared/PageTabButton';
import { timeAgo, getInitials, cn } from '../lib/utils';
import { GroupInvite, JoinRequest } from '../types';

type RequestTab =
  | 'group_invites'
  | 'my_group_requests'
  | 'user_requests_received'
  | 'user_requests_sent';

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<RequestTab>('group_invites');

  // 1. Group Invites
  const { data: invitesData, isLoading: isLoadingInvites } = useQuery({
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

  // 2. My Group Requests (Join Requests)
  const { data: groupRequestsData, isLoading: isLoadingGroupRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => boardsApi.getMyRequests(),
  });

  // 3. User Connection Requests (Sent and Received)
  const { data: userRequestsData, isLoading: isLoadingUserRequests } = useQuery({
    queryKey: ['connections', 'pending'],
    queryFn: async () => {
      const res = await connectionsApi.pending();
      const body = res.data as any;
      return Array.isArray(body) ? body : body.data || [];
    },
  });

  const acceptConnectionMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.accept(id),
    onSuccess: () => {
      toast.success('Connection accepted!');
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
    },
    onError: () => toast.error('Failed to accept connection request'),
  });

  const declineConnectionMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.decline(id),
    onSuccess: () => {
      toast.success('Connection request declined');
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => toast.error('Failed to decline connection request'),
  });

  const cancelConnectionRequestMutation = useMutation({
    mutationFn: (id: string) => connectionsApi.remove(id),
    onSuccess: () => {
      toast.success('Connection request cancelled');
      queryClient.invalidateQueries({ queryKey: ['connections', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['connections', 'second-degree'] });
    },
    onError: () => {
      toast.error('Failed to cancel connection request');
    },
  });

  // Data processing
  const invites: GroupInvite[] = Array.isArray((invitesData?.data as any)?.data)
    ? (invitesData?.data as any).data
    : Array.isArray(invitesData?.data)
    ? (invitesData?.data as any)
    : [];

  const groupRequests: JoinRequest[] = Array.isArray((groupRequestsData?.data as any)?.data)
    ? (groupRequestsData?.data as any).data
    : Array.isArray(groupRequestsData?.data)
    ? (groupRequestsData?.data as any)
    : [];

  const allUserRequests: any[] = userRequestsData || [];

  const receivedUserRequests = useMemo(() => {
    return allUserRequests.filter(
      (req: any) =>
        req.direction === 'received' ||
        (currentUser?.id && (req.receiverId === currentUser.id || req.receiver_id === currentUser.id))
    );
  }, [allUserRequests, currentUser]);

  const sentUserRequests = useMemo(() => {
    return allUserRequests.filter(
      (req: any) =>
        req.direction === 'sent' ||
        (currentUser?.id && (req.requesterId === currentUser.id || req.requester_id === currentUser.id))
    );
  }, [allUserRequests, currentUser]);

  // Counts
  const pendingInvitesCount = invites.filter((i) => i.status === 'pending').length;
  const pendingGroupRequestsCount = groupRequests.filter((r) => r.status === 'pending').length;
  const pendingReceivedCount = receivedUserRequests.filter((r) => r.status === 'pending').length;
  const pendingSentCount = sentUserRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">#requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your incoming and outgoing collaboration invites, group join requests, and peer connections in one place.
        </p>
      </div>

      {/* Four Distinct Buttons */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PageTabButton
          active={activeTab === 'group_invites'}
          onClick={() => setActiveTab('group_invites')}
          icon={EnvelopeIcon}
          title="#groupInvites"
          subtitle="Group invitations"
          count={pendingInvitesCount > 0 ? pendingInvitesCount : invites.length}
          countVariant={pendingInvitesCount > 0 ? 'highlight' : 'default'}
        />

        <PageTabButton
          active={activeTab === 'my_group_requests'}
          onClick={() => setActiveTab('my_group_requests')}
          icon={ClipboardDocumentCheckIcon}
          title="#myGroupRequest"
          subtitle="Applications to teams"
          count={pendingGroupRequestsCount > 0 ? pendingGroupRequestsCount : groupRequests.length}
          countVariant={pendingGroupRequestsCount > 0 ? 'highlight' : 'default'}
        />

        <PageTabButton
          active={activeTab === 'user_requests_received'}
          onClick={() => setActiveTab('user_requests_received')}
          icon={UserPlusIcon}
          title="#receivedRequests"
          subtitle="Incoming peer requests"
          count={pendingReceivedCount > 0 ? pendingReceivedCount : receivedUserRequests.length}
          countVariant={pendingReceivedCount > 0 ? 'highlight' : 'default'}
        />

        <PageTabButton
          active={activeTab === 'user_requests_sent'}
          onClick={() => setActiveTab('user_requests_sent')}
          icon={PaperAirplaneIcon}
          title="#sentRequests"
          subtitle="Outgoing peer requests"
          count={pendingSentCount > 0 ? pendingSentCount : sentUserRequests.length}
          countVariant={pendingSentCount > 0 ? 'highlight' : 'default'}
        />
      </div>

      {/* Main Content Area Based on Selected Button */}

      {/* VIEW 1: GROUP INVITES */}
      {activeTab === 'group_invites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">#groupInvites</h2>
              <p className="text-xs text-gray-500">Direct invitations from project leads to join their engineering teams</p>
            </div>
          </div>

          {isLoadingInvites ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : invites.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
              <ul className="divide-y divide-gray-200">
                {invites.map((invite) => {
                  const isPending = invite.status === 'pending';
                  const isAccepted = invite.status === 'accepted';
                  const isDeclined = invite.status === 'declined';

                  return (
                    <li key={invite.id} className="p-4 sm:p-6 hover:bg-gray-50/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-semibold text-gray-900 truncate">
                              {invite.groupName}
                            </h4>
                            <StatusBadge
                              status={isPending ? 'pending' : isAccepted ? 'approved' : 'rejected'}
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
                              <span className="italic">&quot;{invite.note}&quot;</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => acceptInviteMutation.mutate(invite.id)}
                                disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                                className="inline-flex items-center rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {acceptInviteMutation.isPending ? 'Joining...' : 'Accept & Join'}
                              </button>
                              <button
                                onClick={() => declineInviteMutation.mutate(invite.id)}
                                disabled={acceptInviteMutation.isPending || declineInviteMutation.isPending}
                                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-gray-500 capitalize">
                              {isAccepted ? 'Joined' : isDeclined ? 'Declined' : invite.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <EnvelopeIcon className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No group invitations yet</h3>
              <p className="mt-1 text-xs text-gray-500">
                When group leads invite you to join their engineering projects, they will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: MY GROUP REQUESTS */}
      {activeTab === 'my_group_requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">#myGroupRequest</h2>
              <p className="text-xs text-gray-500">Track status of your membership applications to external project teams</p>
            </div>
          </div>

          {isLoadingGroupRequests ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : groupRequests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
              <ul className="divide-y divide-gray-200">
                {groupRequests.map((request: any) => {
                  const isPending = request.status === 'pending';
                  const isApproved = request.status === 'approved';

                  return (
                    <li key={request.id} className="p-4 sm:p-6 hover:bg-gray-50/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-semibold text-gray-900">
                              {request.postingTitle || request.posting_title || request.posting?.title || 'Group Membership Application'}
                            </h4>
                            <StatusBadge
                              status={isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}
                            />
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            Project Group: <span className="font-semibold text-gray-900">{request.groupName || request.group_name || 'Project Team'}</span>
                          </p>
                          {request.message && (
                            <p className="mt-1 text-xs text-gray-500 italic line-clamp-1">
                              &quot;{request.message}&quot;
                            </p>
                          )}
                          <span className="text-[11px] text-gray-400 mt-1 block">
                            Submitted {timeAgo(request.createdAt || request.created_at)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {isApproved ? (
                            <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800 border border-green-200">
                              Approved & Member
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                              Under Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 border border-red-200">
                              Not Selected
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <ClipboardDocumentCheckIcon className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No group join requests</h3>
              <p className="mt-1 text-xs text-gray-500">
                When you apply to join projects on the boards, your application status will appear here.
              </p>
              <div className="mt-4">
                <Link
                  to="/boards"
                  className="inline-flex items-center rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700"
                >
                  Browse Project Boards
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RECEIVED USER REQUESTS */}
      {activeTab === 'user_requests_received' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">#receivedRequests</h2>
              <p className="text-xs text-gray-500">Connection requests sent to you by other verified students</p>
            </div>
          </div>

          {isLoadingUserRequests ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : receivedUserRequests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
              <ul className="divide-y divide-gray-200">
                {receivedUserRequests.map((req: any) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved' || req.status === 'accepted';
                  const targetProfileId = req.userId || req.requesterId || req.requester_id;

                  return (
                    <li key={req.id} className="p-4 sm:p-6 hover:bg-gray-50/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {req.avatarUrl || req.avatar_url ? (
                            <img
                              src={req.avatarUrl || req.avatar_url}
                              alt={req.name}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                              {getInitials(req.name || 'User')}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/profile/${targetProfileId}`}
                                className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                              >
                                {req.name}
                              </Link>
                              <StatusBadge
                                status={isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {req.collegeName || req.college_name || 'College Student'}
                              {req.branch ? ` • ${req.branch}` : ''}
                              {req.yearOfStudy || req.year_of_study ? ` • Year ${req.yearOfStudy || req.year_of_study}` : ''}
                            </p>
                            {req.bio && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                {req.bio}
                              </p>
                            )}
                            <span className="text-[11px] text-gray-400 mt-1 block">
                              Received {timeAgo(req.createdAt || req.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons or status */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => acceptConnectionMutation.mutate(req.id)}
                                disabled={acceptConnectionMutation.isPending || declineConnectionMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <CheckIcon className="h-4 w-4" />
                                <span>Accept</span>
                              </button>
                              <button
                                onClick={() => declineConnectionMutation.mutate(req.id)}
                                disabled={acceptConnectionMutation.isPending || declineConnectionMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                <XMarkIcon className="h-4 w-4" />
                                <span>Decline</span>
                              </button>
                            </>
                          ) : (
                            <Link
                              to={`/profile/${targetProfileId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              View Profile
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <UserPlusIcon className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No received connection requests</h3>
              <p className="mt-1 text-xs text-gray-500">
                When other students send you a connection request, you can review and accept it here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: SENT USER REQUESTS */}
      {activeTab === 'user_requests_sent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">#sentRequests</h2>
              <p className="text-xs text-gray-500">Connection requests you have sent to peers across campuses</p>
            </div>
          </div>

          {isLoadingUserRequests ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : sentUserRequests.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
              <ul className="divide-y divide-gray-200">
                {sentUserRequests.map((req: any) => {
                  const isPending = req.status === 'pending';
                  const isApproved = req.status === 'approved' || req.status === 'accepted';
                  const targetProfileId = req.userId || req.receiverId || req.receiver_id;

                  return (
                    <li key={req.id} className="p-4 sm:p-6 hover:bg-gray-50/60 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          {req.avatarUrl || req.avatar_url ? (
                            <img
                              src={req.avatarUrl || req.avatar_url}
                              alt={req.name}
                              className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                              {getInitials(req.name || 'User')}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link
                                to={`/profile/${targetProfileId}`}
                                className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors"
                              >
                                {req.name}
                              </Link>
                              <StatusBadge
                                status={isPending ? 'pending' : isApproved ? 'approved' : 'rejected'}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {req.collegeName || req.college_name || 'College Student'}
                              {req.branch ? ` • ${req.branch}` : ''}
                              {req.yearOfStudy || req.year_of_study ? ` • Year ${req.yearOfStudy || req.year_of_study}` : ''}
                            </p>
                            {req.bio && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                {req.bio}
                              </p>
                            )}
                            <span className="text-[11px] text-gray-400 mt-1 block">
                              Sent {timeAgo(req.createdAt || req.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Action or status */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isPending ? (
                            <button
                              onClick={() => cancelConnectionRequestMutation.mutate(req.id)}
                              disabled={cancelConnectionRequestMutation.isPending}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              <span>{cancelConnectionRequestMutation.isPending ? 'Cancelling...' : 'Cancel Request'}</span>
                            </button>
                          ) : (
                            <Link
                              to={`/profile/${targetProfileId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              View Profile
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <ClockIcon className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No sent connection requests</h3>
              <p className="mt-1 text-xs text-gray-500">
                You haven&apos;t sent any pending peer connection requests.
              </p>
              <div className="mt-4">
                <Link
                  to="/peers"
                  className="inline-flex items-center rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-700"
                >
                  Discover Peers
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
