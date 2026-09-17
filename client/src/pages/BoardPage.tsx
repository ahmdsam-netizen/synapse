import { useState, useMemo } from 'react';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { boardsApi } from '../api/boards';
import { PostingCard } from '../components/shared/PostingCard';
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
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreatePostingOpen, setIsCreatePostingOpen] = useState(false);
  const [myPostsSubView, setMyPostsSubView] = useState<'created' | 'requests'>('created');
  const [boardSearch, setBoardSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');

  const filters = useMemo(() => ({
    q: boardSearch.trim() || undefined,
    skills: selectedSkill ? [selectedSkill] : undefined,
  }), [boardSearch, selectedSkill]);

  const queryClient = useQueryClient();

  const {
    data: globalPostings,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
    isLoading: isLoadingGlobal,
    sentinelRef: globalRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'global', filters],
    queryFn: async (cursor) => {
      const res = await boardsApi.getGlobal({ cursor, limit: 30, ...filters });
      const body = res.data as any;
      return body.data || body;
    },
  });

  const {
    data: collegePostings,
    hasNextPage: hasNextCollege,
    isFetchingNextPage: isFetchingNextCollege,
    isLoading: isLoadingCollege,
    sentinelRef: collegeRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'college', filters],
    queryFn: async (cursor) => {
      const res = await boardsApi.getCollege({ cursor, limit: 30, ...filters });
      const body = res.data as any;
      return body.data || body;
    },
  });

  const {
    data: matchedPostings,
    hasNextPage: hasNextMatched,
    isFetchingNextPage: isFetchingNextMatched,
    isLoading: isLoadingMatched,
    sentinelRef: matchedRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'matched'],
    queryFn: async (cursor) => {
      const res = await boardsApi.getMatched(cursor, 30);
      const body = res.data as any;
      return body.data || body;
    },
  });

  const {
    data: myPostings,
    hasNextPage: hasNextMyPostings,
    isFetchingNextPage: isFetchingNextMyPostings,
    isLoading: isLoadingMyPostings,
    sentinelRef: myPostingsRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'my-postings'],
    queryFn: async (cursor) => {
      const res = await boardsApi.getMyPostings({ cursor, limit: 30 });
      const body = res.data as any;
      return body.data || body;
    },
  });

  const { data: myRequestsData, isLoading: isLoadingMyRequests } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => boardsApi.getMyRequests(),
  });

  const myRequests: JoinRequest[] = (myRequestsData?.data as any)?.data || myRequestsData?.data || [];

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

  const renderPostings = (
    postings: BoardPosting[],
    ref: any,
    hasNextPage: boolean,
    isFetchingNextPage: boolean,
    tabType: 'global' | 'college' | 'matched'
  ) => {
    if (postings.length === 0) {
      let emptyTitle = "No postings available";
      let emptyDesc = "Check back later or create your own group posting.";
      if (tabType === 'matched') {
        emptyTitle = "No matching postings found";
        emptyDesc = "Update your profile skills and interests to get matched with relevant groups.";
      } else if (tabType === 'college') {
        emptyTitle = "No postings from your college";
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {postings.map((posting: BoardPosting) => (
            <PostingCard
              key={posting.id}
              posting={posting}
              onRequestClick={() => handleRequestClick(posting)}
              isMatchedTab={tabType === 'matched'}
            />
          ))}
        </div>
        <InfiniteScrollLoader
          ref={ref}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Board</h1>
          <p className="mt-1 text-sm text-gray-500">Discover groups and collaborate with peers</p>
        </div>
        <div>
          <button
            onClick={() => setIsCreatePostingOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Create Posting
          </button>
        </div>
      </div>

      <TabGroup selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
        <TabList className="mb-8 flex space-x-1 rounded-xl bg-gray-100 p-1 max-w-2xl">
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            Global
          </Tab>
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            Same College
          </Tab>
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            Matched
          </Tab>
          <Tab
            className="w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-colors focus:outline-none data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow data-[hover]:bg-white/50 data-[hover]:text-gray-900 text-gray-500"
          >
            My Posts
          </Tab>
        </TabList>

        {/* Search & Skill Quick-Filters (Global, College, Matched) */}
        {selectedTabIndex !== 3 && (
          <div className="mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                placeholder="Filter postings by title, role, or description..."
                className="block w-full rounded-lg border border-gray-200 bg-gray-50/50 py-1.5 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {boardSearch && (
                <button
                  type="button"
                  onClick={() => setBoardSearch('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-gray-400 mr-1 hidden sm:inline">Skills:</span>
              {['React', 'Node.js', 'Python', 'TypeScript', 'Docker'].map((skill) => {
                const isSelected = selectedSkill === skill;
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => setSelectedSkill(isSelected ? '' : skill)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors shrink-0',
                      isSelected
                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    {skill}
                  </button>
                );
              })}
              {(boardSearch || selectedSkill) && (
                <button
                  type="button"
                  onClick={() => {
                    setBoardSearch('');
                    setSelectedSkill('');
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold px-2 py-1 ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        <TabPanels>
          <TabPanel>
            {isLoadingGlobal ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              renderPostings(globalPostings, globalRef, hasNextGlobal, isFetchingNextGlobal, 'global')
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
              renderPostings(collegePostings, collegeRef, hasNextCollege, isFetchingNextCollege, 'college')
            )}
          </TabPanel>
          <TabPanel>
            {isLoadingMatched ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
                ))}
              </div>
            ) : (
              renderPostings(matchedPostings, matchedRef, hasNextMatched, isFetchingNextMatched, 'matched')
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
                My Group Postings ({myPostings.length})
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
              ) : myPostings.length === 0 ? (
                <EmptyState
                  title="No postings created yet"
                  description="You have not created any group postings yet. Post an opening to recruit members for your group."
                  action={{
                    label: 'Create Posting',
                    onClick: () => setIsCreatePostingOpen(true),
                  }}
                />
              ) : (
                <div className="flex flex-col gap-6 pb-12">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {myPostings.map((posting: BoardPosting) => (
                      <PostingCard
                        key={posting.id}
                        posting={posting}
                        isMyPost={true}
                        onDeleteClick={() => handleDeletePosting(posting.id)}
                      />
                    ))}
                  </div>
                  <InfiniteScrollLoader
                    ref={myPostingsRef}
                    hasNextPage={hasNextMyPostings}
                    isFetchingNextPage={isFetchingNextMyPostings}
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
