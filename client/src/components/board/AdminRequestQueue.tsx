import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { boardsApi } from '../../api/boards';
import { timeAgo, getInitials } from '../../lib/utils';
import { EmptyState } from '../shared/EmptyState';
import { JoinRequest } from '../../types';

export function AdminRequestQueue({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();

  const { data: requestsData, isPending } = useQuery({
    queryKey: ['group-requests', groupId],
    queryFn: () => boardsApi.getGroupRequests(groupId),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => boardsApi.approveRequest(requestId),
    onSuccess: () => {
      toast.success('Request approved');
      queryClient.invalidateQueries({ queryKey: ['group-requests', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
    onError: () => toast.error('Failed to approve request'),
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => boardsApi.rejectRequest(requestId),
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['group-requests', groupId] });
    },
    onError: () => toast.error('Failed to reject request'),
  });

  const requests: JoinRequest[] = (requestsData?.data as any)?.data || requestsData?.data || [];

  if (isPending) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No pending requests"
        description="There are no users waiting to join this group at the moment."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Pending Requests</h3>
      <ul className="divide-y divide-gray-100">
        {requests.map((request: any) => {
          const userName = request.userName || (request.user?.name) || 'Student';
          return (
            <li key={request.id} className="py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                    {request.userAvatarUrl || request.user?.avatarUrl ? (
                      <img src={request.userAvatarUrl || request.user?.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      getInitials(userName)
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Requested {timeAgo(request.createdAt || (request as any).created_at)}
                      {(request.postingTitle || request.posting?.title) && ` • for ${request.postingTitle || request.posting?.title}`}
                    </p>
                    {request.message && (
                      <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700 border-l-2 border-primary-500">
                        "{request.message}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                    className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(request.id)}
                    disabled={rejectMutation.isPending}
                    className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
