import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { groupsApi } from '../../api/groups';
import { boardsApi } from '../../api/boards';
import { usersApi } from '../../api/users';
import { Group, Skill, Interest } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';

interface CreatePostingOnlyModalProps {
  open: boolean;
  onClose: () => void;
  initialGroupId?: string;
  onRequestCreateGroup?: () => void;
}

export function CreatePostingOnlyModal({
  open,
  onClose,
  initialGroupId,
  onRequestCreateGroup,
}: CreatePostingOnlyModalProps) {
  const queryClient = useQueryClient();

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['groups', 'me'],
    queryFn: () => groupsApi.getMyGroups(),
    enabled: open,
  });

  const rawGroups: Group[] = (groupsData?.data as any)?.data || groupsData?.data || [];
  const adminGroups = rawGroups.filter((g: any) => g.userRole === 'admin' || g.role === 'admin');

  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rolesNeededText, setRolesNeededText] = useState('');
  const [community, setCommunity] = useState<'project' | 'hackathon' | 'competition'>('project');
  const [expiresInHours, setExpiresInHours] = useState<number>(72);

  // Selected Skills & Interests
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillResults, setSkillResults] = useState<Skill[]>([]);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);
  const [isSkillFocused, setIsSkillFocused] = useState(false);

  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [interestSearch, setInterestSearch] = useState('');
  const [interestResults, setInterestResults] = useState<Interest[]>([]);
  const [isSearchingInterests, setIsSearchingInterests] = useState(false);
  const [isInterestFocused, setIsInterestFocused] = useState(false);

  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
    } else if (adminGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(adminGroups[0].id);
    }
  }, [initialGroupId, adminGroups, selectedGroupId]);

  const addSkillByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSkills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setSkillSearch('');
      setSkillResults([]);
      setIsSkillFocused(false);
      return;
    }
    const match = skillResults.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setSelectedSkills((prev) => [...prev, match]);
    } else {
      setSelectedSkills((prev) => [...prev, { id: trimmed, name: trimmed, category: 'Other' }]);
    }
    setSkillSearch('');
    setSkillResults([]);
    setIsSkillFocused(false);
  };

  const addInterestByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedInterests.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      setInterestSearch('');
      setInterestResults([]);
      setIsInterestFocused(false);
      return;
    }
    const match = interestResults.find((i) => i.name.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setSelectedInterests((prev) => [...prev, match]);
    } else {
      setSelectedInterests((prev) => [...prev, { id: trimmed, name: trimmed, category: 'Other' }]);
    }
    setInterestSearch('');
    setInterestResults([]);
    setIsInterestFocused(false);
  };

  const searchSkills = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setSkillResults([]);
      setIsSearchingSkills(false);
      return;
    }
    setIsSearchingSkills(true);
    try {
      const res = await usersApi.searchSkills(trimmed);
      const skills = (res.data as any)?.data || (res.data as any)?.skills || res.data || [];
      // Filter out already selected
      setSkillResults(skills.filter((s: Skill) => !selectedSkills.some((sel) => sel.id === s.id || sel.name.toLowerCase() === s.name.toLowerCase())));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingSkills(false);
    }
  };

  const debouncedSearchSkills = useDebounce(searchSkills, 200);

  const searchInterests = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setInterestResults([]);
      setIsSearchingInterests(false);
      return;
    }
    setIsSearchingInterests(true);
    try {
      const res = await usersApi.searchInterests(trimmed);
      const interests = (res.data as any)?.data || (res.data as any)?.interests || res.data || [];
      // Filter out already selected
      setInterestResults(interests.filter((i: Interest) => !selectedInterests.some((sel) => sel.id === i.id || sel.name.toLowerCase() === i.name.toLowerCase())));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingInterests(false);
    }
  };

  const debouncedSearchInterests = useDebounce(searchInterests, 200);

  const createPostingMutation = useMutation({
    mutationFn: () => {
      const rolesNeeded = rolesNeededText
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      return boardsApi.createPosting({
        groupId: selectedGroupId,
        title: title.trim(),
        description: description.trim() || undefined,
        community,
        rolesNeeded,
        requiredSkillIds: selectedSkills.map((s) => s.id || s.name),
        requiredInterestIds: selectedInterests.map((i) => i.id || i.name),
        slotsTotal: 1,
        expiresInHours: Number(expiresInHours) || 72,
      });
    },
    onSuccess: () => {
      toast.success('Posting created successfully!');
      queryClient.invalidateQueries({ queryKey: ['board'] });
      if (selectedGroupId) {
        queryClient.invalidateQueries({ queryKey: ['groups', selectedGroupId] });
      }
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create posting');
    },
  });

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setRolesNeededText('');
    setCommunity('project');
    setExpiresInHours(72);
    setSelectedSkills([]);
    setSelectedInterests([]);
    setSkillSearch('');
    setInterestSearch('');
    setSkillResults([]);
    setInterestResults([]);
    setIsSkillFocused(false);
    setIsInterestFocused(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId) {
      toast.error('Please select a group for this posting');
      return;
    }
    if (!title.trim()) {
      toast.error('Posting title is required');
      return;
    }
    createPostingMutation.mutate();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create Group Posting" size="xl">
      {!isLoadingGroups && adminGroups.length === 0 && !initialGroupId ? (
        <div className="text-center py-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">No Admin Groups Found</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
            You must be an admin of a group to publish a recruitment posting on the board.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            {onRequestCreateGroup ? (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onRequestCreateGroup();
                }}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 cursor-pointer"
              >
                Create a Group First
              </button>
            ) : (
              <Link
                to="/"
                onClick={handleClose}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Go to My Groups
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Group *</label>
            {initialGroupId ? (
              <input
                type="text"
                disabled
                value={adminGroups.find((g) => g.id === initialGroupId)?.name || 'Current Group'}
                className="block w-full rounded-lg border border-gray-300 bg-gray-100 py-2.5 px-3.5 text-gray-700 sm:text-sm cursor-not-allowed"
              />
            ) : (
              <select
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm bg-white"
              >
                <option value="" disabled>
                  Select a group you manage
                </option>
                {adminGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Posting Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Seeking Full-Stack Developer for EdTech Startup"
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Description</label>
            <textarea
              placeholder="Detail what the project is about, what responsibilities are expected, and timeline..."
              rows={3}
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Roles Needed (comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Frontend Developer, ML Engineer, UI/UX Designer"
              className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              value={rolesNeededText}
              onChange={(e) => setRolesNeededText(e.target.value)}
            />
          </div>

          {/* Expires In Duration Selector Buttons */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Expires In *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { hours: 24, label: '24 Hours', sub: '1 Day' },
                { hours: 72, label: '3 Days', sub: 'Standard' },
                { hours: 168, label: '7 Days', sub: '1 Week' },
                { hours: 336, label: '14 Days', sub: '2 Weeks' },
              ].map((opt) => (
                <button
                  key={opt.hours}
                  type="button"
                  onClick={() => setExpiresInHours(opt.hours)}
                  className={cn(
                    "py-2.5 px-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer text-center flex flex-col items-center justify-center",
                    expiresInHours === opt.hours
                      ? "bg-primary-50 border-primary-600 text-primary-900 shadow-xs"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] font-normal text-gray-500 mt-0.5">{opt.sub}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Temporary post: automatically auto-deletes after the selected duration or when an applicant is approved.
            </p>
          </div>

          {/* Required Skills Search & Chips */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Required Skills</label>
            <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
              {selectedSkills.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800 border border-primary-200"
                >
                  {s.name}
                  <button
                    type="button"
                    onClick={() => setSelectedSkills((prev) => prev.filter((item) => item.id !== s.id))}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search skills or type custom skill and press Enter..."
                value={skillSearch}
                onFocus={() => {
                  setIsSkillFocused(true);
                  if (skillSearch.trim()) {
                    debouncedSearchSkills(skillSearch);
                  }
                }}
                onBlur={() => {
                  setIsSkillFocused(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (skillSearch.trim()) {
                      addSkillByName(skillSearch);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSkillFocused(false);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSkillSearch(val);
                  if (val.trim()) {
                    debouncedSearchSkills(val);
                  } else {
                    setSkillResults([]);
                  }
                }}
                className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              />
              {isSkillFocused && skillSearch.trim().length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                >
                  {isSearchingSkills && skillResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Searching skills...</div>
                  ) : (
                    <>
                      {skillResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSkills((prev) => [...prev, s]);
                            setSkillSearch('');
                            setSkillResults([]);
                            setIsSkillFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded-md flex justify-between items-center cursor-pointer"
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-gray-400 text-[10px] uppercase">{s.category}</span>
                        </button>
                      ))}
                      {!skillResults.some((s) => s.name.toLowerCase() === skillSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            addSkillByName(skillSearch);
                            setIsSkillFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-primary-700 font-semibold hover:bg-primary-50 rounded-md flex justify-between items-center border-t border-gray-100 cursor-pointer"
                        >
                          <span>+ Add &quot;{skillSearch.trim()}&quot;</span>
                          <span className="text-gray-400 text-[10px]">Custom</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Required Interests Search & Chips */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Required Interests</label>
            <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
              {selectedInterests.map((i) => (
                <span
                  key={i.id}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 border border-gray-200"
                >
                  {i.name}
                  <button
                    type="button"
                    onClick={() => setSelectedInterests((prev) => prev.filter((item) => item.id !== i.id))}
                    className="text-gray-400 hover:text-gray-700 cursor-pointer ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search interests or type custom interest and press Enter..."
                value={interestSearch}
                onFocus={() => {
                  setIsInterestFocused(true);
                  if (interestSearch.trim()) {
                    debouncedSearchInterests(interestSearch);
                  }
                }}
                onBlur={() => {
                  setIsInterestFocused(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (interestSearch.trim()) {
                      addInterestByName(interestSearch);
                    }
                  } else if (e.key === 'Escape') {
                    setIsInterestFocused(false);
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setInterestSearch(val);
                  if (val.trim()) {
                    debouncedSearchInterests(val);
                  } else {
                    setInterestResults([]);
                  }
                }}
                className="block w-full rounded-lg border border-gray-300 py-2.5 px-3.5 text-gray-900 shadow-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:text-sm"
              />
              {isInterestFocused && interestSearch.trim().length > 0 && (
                <div
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
                >
                  {isSearchingInterests && interestResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-500">Searching interests...</div>
                  ) : (
                    <>
                      {interestResults.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => {
                            setSelectedInterests((prev) => [...prev, i]);
                            setInterestSearch('');
                            setInterestResults([]);
                            setIsInterestFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-md flex justify-between items-center cursor-pointer"
                        >
                          <span className="font-medium">{i.name}</span>
                          <span className="text-gray-400 text-[10px] uppercase">{i.category}</span>
                        </button>
                      ))}
                      {!interestResults.some((i) => i.name.toLowerCase() === interestSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => {
                            addInterestByName(interestSearch);
                            setIsInterestFocused(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-primary-700 font-semibold hover:bg-primary-50 rounded-md flex justify-between items-center border-t border-gray-100 cursor-pointer"
                        >
                          <span>+ Add &quot;{interestSearch.trim()}&quot;</span>
                          <span className="text-gray-400 text-[10px]">Custom</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
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
              disabled={createPostingMutation.isPending || !selectedGroupId}
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-700 focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              {createPostingMutation.isPending ? 'Publishing...' : 'Publish Posting'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
