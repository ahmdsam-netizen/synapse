import { useState, useMemo } from 'react';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { boardsApi } from '../api/boards';
import { groupsApi } from '../api/groups';
import { PostingCard } from '../components/shared/PostingCard';
import { PostingDetailView } from '../components/board/PostingDetailView';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { JoinRequestModal } from '../components/board/JoinRequestModal';
import { CreatePostingOnlyModal } from '../components/board/CreatePostingOnlyModal';
import { StatusBadge } from '../components/shared/StatusBadge';
import { BoardPosting, JoinRequest } from '../types';
import { cn, timeAgo } from '../lib/utils';

export default function BoardPage() {
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedPosting, setSelectedPosting] = useState<BoardPosting | null>(null);
  const [viewingPosting, setViewingPosting] = useState<BoardPosting | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreatePostingOpen, setIsCreatePostingOpen] = useState(false);
  const [myPostsSubView, setMyPostsSubView] = useState<'created' | 'requests'>('created');
  const [boardSearch, setBoardSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState<'project' | 'hackathon' | 'competition'>('project');

  const filters = useMemo(() => ({
    q: boardSearch.trim() || undefined,
    skills: selectedSkill ? [selectedSkill] : undefined,
    community: selectedCommunity,
  }), [boardSearch, selectedSkill, selectedCommunity]);

  const queryClient = useQueryClient();

  const normalizePaginated = (resData: any) => {
    if (Array.isArray(resData)) return { data: resData, nextCursor: null };
    if (Array.isArray(resData?.data?.data)) return { data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
    if (Array.isArray(resData?.data)) return { data: resData.data, nextCursor: resData.nextCursor ?? null };
    return resData || { data: [], nextCursor: null };
  };

  const {
    data: globalPostings,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
    isLoading: isLoadingGlobal,
    fetchNextPage: fetchNextGlobal,
    sentinelRef: globalRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'global', filters],
    queryFn: async (cursor) => {
      const res = await boardsApi.getGlobal({ cursor, limit: 30, ...filters });
      return normalizePaginated(res.data);
    },
  });

  const {
    data: collegePostings,
    hasNextPage: hasNextCollege,
    isFetchingNextPage: isFetchingNextCollege,
    isLoading: isLoadingCollege,
    fetchNextPage: fetchNextCollege,
    sentinelRef: collegeRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'college', filters],
    queryFn: async (cursor) => {
      const res = await boardsApi.getCollege({ cursor, limit: 30, ...filters });
      return normalizePaginated(res.data);
    },
  });


  const {
    data: myPostings,
    hasNextPage: hasNextMyPostings,
    isFetchingNextPage: isFetchingNextMyPostings,
    isLoading: isLoadingMyPostings,
    fetchNextPage: fetchNextMyPostings,
    sentinelRef: myPostingsRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'my-postings', selectedCommunity],
    queryFn: async (cursor) => {
      const res = await boardsApi.getMyPostings({ cursor, limit: 30, community: selectedCommunity });
      return normalizePaginated(res.data);
    },
  });

  const { data: myRequestsData, isLoading: isLoadingMyRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => boardsApi.getMyRequests(),
  });

  const myRequests: JoinRequest[] = (myRequestsData?.data as any)?.data || myRequestsData?.data || [];

  const { data: myGroupsData } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
  });
  const myGroups: any[] = (myGroupsData?.data as any)?.data || myGroupsData?.data || [];
  const isAdminOfAnyGroup = myGroups.some((g: any) => g.userRole === 'admin' || g.role === 'admin');

  const deletePostingMutation = useMutation({
    mutationFn: (postingId: string) => boardsApi.deletePosting(postingId),
    onSuccess: () => {
      toast.success('Posting deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['board'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete posting');
    },
  });

  const handleDeletePosting = (postingId: string) => {
    if (window.confirm('Are you sure you want to delete this posting? All pending join requests for this posting will also be removed.')) {
      deletePostingMutation.mutate(postingId);
    }
  };

  const handleRequestClick = (posting: BoardPosting) => {
    setSelectedPosting(posting);
    setIsJoinModalOpen(true);
  };

  const filterByCommunity = (list: BoardPosting[]) => {
    return list.filter((p) => {
      const comm = ((p.community || (p as any).community || 'project') as string).toLowerCase();
      return comm === selectedCommunity;
    });
  };

  const renderPostings = (
    postings: BoardPosting[],
    ref: any,
    hasNextPage: boolean,
    isFetchingNextPage: boolean,
    tabType: 'global' | 'college' | 'my-postings',
    onLoadMore?: () => void
  ) => {
    const filtered = filterByCommunity(postings);

    if (filtered.length === 0) {
      let emptyTitle = `No #${selectedCommunity} postings available`;
      let emptyDesc = `There are currently no #${selectedCommunity} postings in this view. Try selecting another community or create a new posting.`;
      if (tabType === 'college') {
        emptyTitle = `No #${selectedCommunity} postings from your college`;
        emptyDesc = "Be the first in your college to create a group and posting!";
      }

      return (
        <EmptyState
          title={emptyTitle}
          description={emptyDesc}
        />
      );
    }

    return (
      <div className="flex flex-col gap-6 pb-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((posting: BoardPosting) => (
            <PostingCard
              key={posting.id}
              posting={posting}
              onClick={() => setViewingPosting(posting)}
              isMyPost={tabType === 'my-postings'}
            />
          ))}
        </div>
        <InfiniteScrollLoader
          ref={ref}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
          label="Load More Postings"
        />
      </div>
    );
  };

  if (viewingPosting) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PostingDetailView
          posting={viewingPosting}
          onBack={() => setViewingPosting(null)}
          onRequestClick={() => {
            setSelectedPosting(viewingPosting);
            setIsJoinModalOpen(true);
          }}
          onDeleteClick={() => {
            handleDeletePosting(viewingPosting.id);
            setViewingPosting(null);
          }}
        />

        {selectedPosting && (
          <JoinRequestModal
            open={isJoinModalOpen}
            onClose={() => {
              setIsJoinModalOpen(false);
              setTimeout(() => setSelectedPosting(null), 300);
            }}
            onSuccess={() => {
              setViewingPosting((prev) => (prev ? { ...prev, hasRequested: true } : null));
            }}
            posting={selectedPosting}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#board</h1>
          <p className="mt-1 text-sm text-gray-500">Discover groups and collaborate with peers</p>
        </div>
        <div>
          {isAdminOfAnyGroup && (
            <button
              onClick={() => setIsCreatePostingOpen(true)}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Create Posting
            </button>
          )}
        </div>
      </div>

      <TabGroup selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
        <TabList className="mb-8 flex space-x-1 rounded-xl bg-gray-100 p-1 max-w-2xl">
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            #all
          </Tab>
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            #myCollege
          </Tab>
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            #byMe
          </Tab>
        </TabList>

        {/* Community Filter Pills: #project, #hackathon, #competition */}
        <div className="mb-6 flex items-center flex-wrap gap-2">
          <span className="text-xs font-semibold text-gray-500 mr-1 uppercase tracking-wider">
            Community:
          </span>
          {[
            { id: 'project', label: '#project' },
            { id: 'hackathon', label: '#hackathon' },
            { id: 'competition', label: '#competition' },
          ].map((c) => {
            const isSelected = selectedCommunity === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCommunity(c.id as any)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border',
                  isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <TabPanels>
          <TabPanel>
            {isLoadingGlobal ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              renderPostings(globalPostings, globalRef, hasNextGlobal, isFetchingNextGlobal, 'global', () => fetchNextGlobal())
            )}
          </TabPanel>
          <TabPanel>
            {isLoadingCollege ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              renderPostings(collegePostings, collegeRef, hasNextCollege, isFetchingNextCollege, 'college', () => fetchNextCollege())
            )}
          </TabPanel>
          <TabPanel>
            <div className="flex items-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setMyPostsSubView('created')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  myPostsSubView === 'created'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                My Group Postings ({filterByCommunity(myPostings).length})
              </button>
              <button
                type="button"
                onClick={() => setMyPostsSubView('requests')}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  myPostsSubView === 'requests'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                My Sent Requests ({Array.isArray(myRequests) ? myRequests.length : 0})
              </button>
            </div>

            {myPostsSubView === 'created' ? (
              isLoadingMyPostings ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
                  ))}
                </div>
              ) : filterByCommunity(myPostings).length === 0 ? (
                <EmptyState
                  title={`No #${selectedCommunity} postings created`}
                  description={`You have not created any #${selectedCommunity} postings yet.`}
                  action={{
                    label: 'Create Posting',
                    onClick: () => setIsCreatePostingOpen(true),
                  }}
                />
              ) : (
                <div className="flex flex-col gap-6 pb-12">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filterByCommunity(myPostings).map((posting: BoardPosting) => (
                      <PostingCard
                        key={posting.id}
                        posting={posting}
                        isMyPost={true}
                        onClick={() => setViewingPosting(posting)}
                      />
                    ))}
                  </div>
                  <InfiniteScrollLoader
                    ref={myPostingsRef}
                    hasNextPage={hasNextMyPostings}
                    isFetchingNextPage={isFetchingNextMyPostings}
                    onLoadMore={() => fetchNextMyPostings()}
                    label="Load More Postings"
                  />
                </div>
              )
            ) : isLoadingMyRequests ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
                ))}
              </div>
            ) : myRequests.length === 0 ? (
              <EmptyState
                title="No join requests sent"
                description="You haven't requested to join any group postings yet."
                action={{
                  label: 'Browse Global Board',
                  onClick: () => setSelectedTabIndex(0),
                }}
              />
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <ul className="divide-y divide-gray-200">
                  {myRequests.map((request: any) => (
                    <li key={request.id} className="p-4 hover:bg-gray-50 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900">
                            {request.postingTitle || request.posting_title || request.posting?.title || 'Group Membership'}
                          </h4>
                          <p className="mt-1 text-sm text-gray-500">
                            Group: <span className="font-medium text-gray-700">{request.groupName || request.group_name || request.group?.name || 'Group'}</span>
                          </p>
                          {request.message && (
                            <p className="mt-1 text-xs text-gray-600 italic">
                              "{request.message}"
                            </p>
                          )}
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
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {selectedPosting && (
        <JoinRequestModal
          open={isJoinModalOpen}
          onClose={() => {
            setIsJoinModalOpen(false);
            setTimeout(() => setSelectedPosting(null), 300);
          }}
          posting={selectedPosting}
        />
      )}

      <CreatePostingOnlyModal
        open={isCreatePostingOpen}
        onClose={() => setIsCreatePostingOpen(false)}
      />
    </div>
  );
}
