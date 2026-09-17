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
  const [slotsTotal, setSlotsTotal] = useState(2);
  const [expiresInHours, setExpiresInHours] = useState<number>(72);

  // Selected Skills & Interests
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [skillResults, setSkillResults] = useState<Skill[]>([]);
  const [isSearchingSkills, setIsSearchingSkills] = useState(false);

  const [selectedInterests, setSelectedInterests] = useState<Interest[]>([]);
  const [interestSearch, setInterestSearch] = useState('');
  const [interestResults, setInterestResults] = useState<Interest[]>([]);
  const [isSearchingInterests, setIsSearchingInterests] = useState(false);

  useEffect(() => {
    if (initialGroupId) {
      setSelectedGroupId(initialGroupId);
    } else if (adminGroups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(adminGroups[0].id);
    }
  }, [initialGroupId, adminGroups, selectedGroupId]);

  const searchSkills = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setSkillResults([]);
      setIsSearchingSkills(false);
      return;
    }
    setIsSearchingSkills(true);
    try {
      const res = await usersApi.searchSkills(term);
      const skills = (res.data as any)?.data || (res.data as any)?.skills || res.data || [];
      // Filter out already selected
      setSkillResults(skills.filter((s: Skill) => !selectedSkills.some((sel) => sel.id === s.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingSkills(false);
    }
  };

  const debouncedSearchSkills = useDebounce(searchSkills, 250);

  const searchInterests = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setInterestResults([]);
      setIsSearchingInterests(false);
      return;
    }
    setIsSearchingInterests(true);
    try {
      const res = await usersApi.searchInterests(term);
      const interests = (res.data as any)?.data || (res.data as any)?.interests || res.data || [];
      // Filter out already selected
      setInterestResults(interests.filter((i: Interest) => !selectedInterests.some((sel) => sel.id === i.id)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingInterests(false);
    }
  };

  const debouncedSearchInterests = useDebounce(searchInterests, 250);

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
        rolesNeeded,
        requiredSkillIds: selectedSkills.map((s) => s.id),
        requiredInterestIds: selectedInterests.map((i) => i.id),
        slotsTotal: Number(slotsTotal) || 1,
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
    setSlotsTotal(2);
    setExpiresInHours(72);
    setSelectedSkills([]);
    setSelectedInterests([]);
    setSkillSearch('');
    setInterestSearch('');
    setSkillResults([]);
    setInterestResults([]);
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
    <Modal open={open} onClose={handleClose} title="Create Group Posting" size="lg">
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
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
              >
                Create a Group First
              </button>
            ) : (
              <Link
                to="/"
                onClick={handleClose}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
              >
                Go to My Groups
              </Link>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          <div>
            <label className="block text-sm font-medium text-gray-900">Group *</label>
            {initialGroupId ? (
              <input
                type="text"
                disabled
                value={adminGroups.find((g) => g.id === initialGroupId)?.name || 'Current Group'}
                className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 py-2 px-3 text-gray-700 sm:text-sm cursor-not-allowed"
              />
            ) : (
              <select
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm bg-white"
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
            <label className="block text-sm font-medium text-gray-900">Posting Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Seeking Full-Stack Developer for EdTech Startup"
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900">Description</label>
            <textarea
              placeholder="Detail what the project is about, what responsibilities are expected, and timeline..."
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900">Roles Needed (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. Frontend Dev, UI/UX Designer"
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
                value={rolesNeededText}
                onChange={(e) => setRolesNeededText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-900">Slots to Fill *</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
                  value={slotsTotal}
                  onChange={(e) => setSlotsTotal(parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900">Expires In *</label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-2 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm bg-white"
                >
                  <optgroup label="Few Hours">
                    <option value={6}>6 Hours</option>
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours (1 Day)</option>
                  </optgroup>
                  <optgroup label="Few Days">
                    <option value={72}>3 Days (Default)</option>
                    <option value={168}>7 Days (1 Week)</option>
                    <option value={336}>14 Days (2 Weeks)</option>
                  </optgroup>
                </select>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            Temporary post: automatically auto-deletes after the selected time or when all slots are filled.
          </p>

          {/* Required Skills Search & Chips */}
          <div>
            <label className="block text-sm font-medium text-gray-900">Required Skills</label>
            <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
              {selectedSkills.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200"
                >
                  {s.name}
                  <button
                    type="button"
                    onClick={() => setSelectedSkills((prev) => prev.filter((item) => item.id !== s.id))}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search skills to add (e.g. React, Python, Docker)..."
              value={skillSearch}
              onChange={(e) => {
                setSkillSearch(e.target.value);
                debouncedSearchSkills(e.target.value);
              }}
              className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
            />
            {skillResults.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                {skillResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSkills((prev) => [...prev, s]);
                      setSkillSearch('');
                      setSkillResults([]);
                    }}
                    className="w-full text-left px-2 py-1 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 rounded flex justify-between items-center"
                  >
                    <span>{s.name}</span>
                    <span className="text-gray-400 text-[10px] uppercase">{s.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Required Interests Search & Chips */}
          <div>
            <label className="block text-sm font-medium text-gray-900">Required Interests</label>
            <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
              {selectedInterests.map((i) => (
                <span
                  key={i.id}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200"
                >
                  {i.name}
                  <button
                    type="button"
                    onClick={() => setSelectedInterests((prev) => prev.filter((item) => item.id !== i.id))}
                    className="text-purple-500 hover:text-purple-700"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search interests to add (e.g. AI, Open Source, Web3)..."
              value={interestSearch}
              onChange={(e) => {
                setInterestSearch(e.target.value);
                debouncedSearchInterests(e.target.value);
              }}
              className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 sm:text-sm"
            />
            {interestResults.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                {interestResults.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => {
                      setSelectedInterests((prev) => [...prev, i]);
                      setInterestSearch('');
                      setInterestResults([]);
                    }}
                    className="w-full text-left px-2 py-1 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded flex justify-between items-center"
                  >
                    <span>{i.name}</span>
                    <span className="text-gray-400 text-[10px] uppercase">{i.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPostingMutation.isPending || !selectedGroupId}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none disabled:opacity-50"
            >
              {createPostingMutation.isPending ? 'Publishing...' : 'Publish Posting'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
