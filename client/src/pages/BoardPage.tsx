import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  GlobeAltIcon,
  AcademicCapIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { boardsApi } from '../api/boards';
import { groupsApi } from '../api/groups';
import { PostingCard } from '../components/shared/PostingCard';
import { PostingDetailView } from '../components/board/PostingDetailView';
import { EmptyState } from '../components/shared/EmptyState';
import { InfiniteScrollLoader } from '../components/shared/InfiniteScrollLoader';
import { JoinRequestModal } from '../components/board/JoinRequestModal';
import { CreatePostingOnlyModal } from '../components/board/CreatePostingOnlyModal';
import { CreateGroupOnlyModal } from '../components/board/CreateGroupOnlyModal';
import { PageTabButton } from '../components/shared/PageTabButton';
import { BoardPosting } from '../types';
import { cn } from '../lib/utils';

export default function BoardPage() {
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const [selectedPosting, setSelectedPosting] = useState<BoardPosting | null>(null);
  const [viewingPosting, setViewingPosting] = useState<BoardPosting | null>(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreatePostingOpen, setIsCreatePostingOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [postingInitialGroupId, setPostingInitialGroupId] = useState<string | undefined>(undefined);

  // Search Post state
  const [searchPostInput, setSearchPostInput] = useState('');
  const [appliedPostQuery, setAppliedPostQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'project' | 'hackathon' | 'competition'>('all');
  const [hasSearchedPost, setHasSearchedPost] = useState(false);

  const queryClient = useQueryClient();

  const normalizePaginated = (resData: any) => {
    if (Array.isArray(resData)) return { data: resData, nextCursor: null };
    if (Array.isArray(resData?.data?.data)) return { data: resData.data.data, nextCursor: resData.data.nextCursor ?? null };
    if (Array.isArray(resData?.data)) return { data: resData.data, nextCursor: resData.nextCursor ?? null };
    return resData || { data: [], nextCursor: null };
  };

  // 1. Global Postings
  const {
    data: globalPostings,
    hasNextPage: hasNextGlobal,
    isFetchingNextPage: isFetchingNextGlobal,
    isLoading: isLoadingGlobal,
    fetchNextPage: fetchNextGlobal,
    sentinelRef: globalRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'global'],
    queryFn: async (cursor) => {
      const res = await boardsApi.getGlobal({ cursor, limit: 30 });
      return normalizePaginated(res.data);
    },
  });

  // 2. Campus Postings
  const {
    data: collegePostings,
    hasNextPage: hasNextCollege,
    isFetchingNextPage: isFetchingNextCollege,
    isLoading: isLoadingCollege,
    fetchNextPage: fetchNextCollege,
    sentinelRef: collegeRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'college'],
    queryFn: async (cursor) => {
      const res = await boardsApi.getCollege({ cursor, limit: 30 });
      return normalizePaginated(res.data);
    },
  });

  // 3. User's Own Postings
  const {
    data: myPostings,
    hasNextPage: hasNextMyPostings,
    isFetchingNextPage: isFetchingNextMyPostings,
    isLoading: isLoadingMyPostings,
    fetchNextPage: fetchNextMyPostings,
    sentinelRef: myPostingsRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'my-postings'],
    queryFn: async (cursor) => {
      const res = await boardsApi.getMyPostings({ cursor, limit: 30 });
      return normalizePaginated(res.data);
    },
  });

  // 4. Search Postings
  const {
    data: searchPostings,
    hasNextPage: hasNextSearch,
    isFetchingNextPage: isFetchingNextSearch,
    isLoading: isLoadingSearch,
    fetchNextPage: fetchNextSearch,
    sentinelRef: searchRef,
  } = useInfiniteScroll<BoardPosting>({
    queryKey: ['board', 'search', appliedPostQuery, selectedCategory],
    enabled: hasSearchedPost,
    queryFn: async (cursor) => {
      const res = await boardsApi.getGlobal({
        cursor,
        limit: 30,
        q: appliedPostQuery || undefined,
        community: selectedCategory !== 'all' ? selectedCategory : undefined,
      });
      return normalizePaginated(res.data);
    },
  });

  const handleSearchPost = () => {
    setAppliedPostQuery(searchPostInput.trim());
    setHasSearchedPost(true);
  };

  const handleCategoryChange = (cat: 'all' | 'project' | 'hackathon' | 'competition') => {
    setSelectedCategory(cat);
    setAppliedPostQuery(searchPostInput.trim());
    setHasSearchedPost(true);
  };

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

  const renderPostings = (
    postings: BoardPosting[],
    ref: any,
    hasNextPage: boolean,
    isFetchingNextPage: boolean,
    tabType: 'global' | 'college' | 'my-postings',
    onLoadMore?: () => void
  ) => {
    if (postings.length === 0) {
      let emptyTitle = 'No postings available';
      let emptyDesc = 'There are currently no active recruitment postings in this view. Check back soon or create a new posting.';
      if (tabType === 'college') {
        emptyTitle = 'No postings from your campus';
        emptyDesc = 'Be the first on your campus to create a group and recruitment posting!';
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
          {postings.map((posting: BoardPosting) => (
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
          onRequestClick={() => handleRequestClick(viewingPosting)}
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
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">#board</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse verified student recruitment postings for hackathons, engineering capstones, and competitions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreatePostingOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Create Post</span>
        </button>
      </div>

      {/* Switcher Buttons */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <PageTabButton
          active={selectedTabIndex === 0}
          onClick={() => setSelectedTabIndex(0)}
          icon={GlobeAltIcon}
          title="#all"
          subtitle="Global project postings"
        />
        <PageTabButton
          active={selectedTabIndex === 1}
          onClick={() => setSelectedTabIndex(1)}
          icon={AcademicCapIcon}
          title="#myCollege"
          subtitle="Campus project postings"
        />
        <PageTabButton
          active={selectedTabIndex === 2}
          onClick={() => setSelectedTabIndex(2)}
          icon={FolderIcon}
          title="#byMe"
          subtitle="Your group postings"
          count={myPostings.length}
        />
        <PageTabButton
          active={selectedTabIndex === 3}
          onClick={() => setSelectedTabIndex(3)}
          icon={MagnifyingGlassIcon}
          title="#searchPost"
          subtitle="Search & filter postings"
        />
      </div>

      {/* VIEW 0: ALL GLOBAL POSTINGS */}
      {selectedTabIndex === 0 && (
        <>
          {isLoadingGlobal ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : (
            renderPostings(
              globalPostings,
              globalRef,
              hasNextGlobal,
              isFetchingNextGlobal,
              'global',
              () => fetchNextGlobal()
            )
          )}
        </>
      )}

      {/* VIEW 1: MY COLLEGE POSTINGS */}
      {selectedTabIndex === 1 && (
        <>
          {isLoadingCollege ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : (
            renderPostings(
              collegePostings,
              collegeRef,
              hasNextCollege,
              isFetchingNextCollege,
              'college',
              () => fetchNextCollege()
            )
          )}
        </>
      )}

      {/* VIEW 2: BY ME */}
      {selectedTabIndex === 2 && (
        <>
          {isLoadingMyPostings ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : myPostings.length === 0 ? (
            <EmptyState
              title="No postings created"
              description="You have not created any postings yet."
              action={
                isAdminOfAnyGroup
                  ? {
                      label: 'Create Posting',
                      onClick: () => setIsCreatePostingOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            renderPostings(
              myPostings,
              myPostingsRef,
              hasNextMyPostings,
              isFetchingNextMyPostings,
              'my-postings',
              () => fetchNextMyPostings()
            )
          )}
        </>
      )}

      {/* VIEW 3: SEARCH POST */}
      {selectedTabIndex === 3 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            {/* Search Input bar */}
            <div className="flex gap-2 max-w-xl">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchPostInput}
                  onChange={(e) => setSearchPostInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchPost();
                  }}
                  placeholder="Search postings by role, skill, or project title..."
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 shadow-xs"
                />
                {searchPostInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchPostInput('');
                      setAppliedPostQuery('');
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleSearchPost}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors cursor-pointer shrink-0"
              >
                Search
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Category:</span>
              {(['all', 'project', 'hackathon', 'competition'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    'rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-all cursor-pointer border',
                    selectedCategory === cat
                      ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
          </div>

          {!hasSearchedPost ? (
            <EmptyState
              title="Search recruitment postings"
              description="Enter keywords (roles, skills, or project names) and pick a category above to find student teams."
            />
          ) : isLoadingSearch && searchPostings.length === 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200" />
              ))}
            </div>
          ) : searchPostings.length === 0 ? (
            <EmptyState
              title="No postings found"
              description={`No project postings matched "${appliedPostQuery || selectedCategory}". Try broader keywords or clearing your category filter.`}
            />
          ) : (
            renderPostings(
              searchPostings,
              searchRef,
              hasNextSearch,
              isFetchingNextSearch,
              'global',
              () => fetchNextSearch()
            )
          )}
        </div>
      )}

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
        onClose={() => {
          setIsCreatePostingOpen(false);
          setPostingInitialGroupId(undefined);
        }}
        initialGroupId={postingInitialGroupId}
        onRequestCreateGroup={() => {
          setIsCreatePostingOpen(false);
          setIsCreateGroupOpen(true);
        }}
      />

      <CreateGroupOnlyModal
        open={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={(newGroupId) => {
          setIsCreateGroupOpen(false);
          setPostingInitialGroupId(newGroupId);
          setIsCreatePostingOpen(true);
        }}
      />
    </div>
  );
}
