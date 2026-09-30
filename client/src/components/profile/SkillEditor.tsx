import { useState, useEffect, ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';
import { Skill } from '../../types';
import { PlusIcon } from '@heroicons/react/24/outline';

interface SkillEditorProps {
  skills: any[];
  isOwnProfile: boolean;
}

export default function SkillEditor({ skills, isOwnProfile }: SkillEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Skill[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<Skill[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<{ id?: string; name: string; category?: string } | null>(null);
  const [proficiency, setProficiency] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const addSkillMutation = useMutation({
    mutationFn: (data: { skillId?: string; name?: string; proficiency: string }) =>
      usersApi.addSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      resetForm();
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Failed to add skill. Please try again.');
    }
  });

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: string) => usersApi.removeSkill(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  });

  // Load popular/all suggestions when entering add mode
  useEffect(() => {
    if (!isAdding) return;
    let isMounted = true;
    setIsLoadingSuggestions(true);
    usersApi.searchSkills('')
      .then((res) => {
        if (!isMounted) return;
        const raw = (res.data as any)?.data || (res.data as any)?.skills || res.data || [];
        setAllSuggestions(Array.isArray(raw) ? raw : []);
      })
      .catch((e) => console.error('Failed to load initial skills', e))
      .finally(() => {
        if (isMounted) setIsLoadingSuggestions(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isAdding]);

  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await usersApi.searchSkills(term.trim());
      const raw = (res.data as any)?.data || (res.data as any)?.skills || res.data || [];
      setSearchResults(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.error('Failed to search skills', e);
    }
  };

  const debouncedSearchTerm = useDebounce(searchTerm, 250);

  useEffect(() => {
    handleSearch(debouncedSearchTerm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setErrorMessage(null);
    if (selectedSkill && selectedSkill.name !== val) {
      setSelectedSkill(null);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedSkill(null);
    setProficiency('intermediate');
    setErrorMessage(null);
  };

  const handleAdd = () => {
    if (!selectedSkill) return;
    setErrorMessage(null);
    addSkillMutation.mutate({
      skillId: selectedSkill.id,
      name: selectedSkill.name,
      proficiency
    });
  };

  const getProficiencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-amber-500';
      case 'intermediate': return 'bg-primary-500';
      case 'advanced': return 'bg-primary-700';
      default: return 'bg-gray-400';
    }
  };

  // Helper set to filter out already-added skills
  const addedSkillNames = new Set(
    skills.map((s) => (s.name || s.skill?.name || '').toLowerCase())
  );
  const addedSkillIds = new Set(
    skills.map((s) => s.id || s.skill_id)
  );

  const isAlreadyAdded = (item: Skill) =>
    addedSkillIds.has(item.id) || addedSkillNames.has(item.name.toLowerCase());

  // Filtered suggestions that are not already in user's profile
  const unaddedSuggestions = allSuggestions.filter((s) => !isAlreadyAdded(s));
  const filteredResults = searchResults.filter((s) => !isAlreadyAdded(s));

  // Check if typed search term exactly matches an existing suggestion
  const exactMatchExists = searchResults.some(
    (s) => s.name.toLowerCase() === searchTerm.trim().toLowerCase()
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">#skills</h3>
          <p className="text-xs text-gray-500 mt-0.5">Verified technical competencies and tools for engineering matching</p>
        </div>
        {isOwnProfile && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-semibold hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
          >
            + Add Skill
          </button>
        )}
      </div>

      {/* Current User Skills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {skills.map((s) => {
          const id = s.id || s.skill_id;
          const name = s.name || s.skill?.name;
          const prof = s.proficiency || 'intermediate';
          return (
            <div
              key={id || name}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-primary-50 text-primary-900 border border-primary-200"
            >
              <span
                className={cn("w-1.5 h-1.5 rounded-full mr-2 shrink-0", getProficiencyColor(prof))}
                title={`Proficiency: ${prof}`}
              />
              <span className="font-semibold">{name}</span>
              <span className="ml-1.5 text-xs text-primary-700/80 capitalize font-normal">
                ({prof})
              </span>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => removeSkillMutation.mutate(id)}
                  disabled={removeSkillMutation.isPending}
                  className="ml-2 text-primary-600 hover:text-red-600 hover:bg-primary-100/50 rounded w-4 h-4 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                  title="Remove skill"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {skills.length === 0 && !isAdding && (
          <div className="w-full rounded-lg border border-dashed border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500">No skills added yet. Add verified technical proficiencies to improve matchmaking accuracy.</p>
          </div>
        )}
      </div>

      {/* Adding Mode */}
      {isAdding && (
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Add a New Skill</span>
            <button
              onClick={resetForm}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {errorMessage && (
            <div className="p-2.5 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* Selected Skill Banner (if any) */}
          {selectedSkill ? (
            <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-700 font-medium uppercase tracking-wide">Selected:</span>
                <span className="font-semibold text-primary-900">{selectedSkill.name}</span>
                {selectedSkill.category && (
                  <span className="text-xs bg-white text-primary-800 border border-primary-200 px-2 py-0.5 rounded-md font-medium">
                    {selectedSkill.category}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSkill(null);
                  setSearchTerm('');
                }}
                className="text-xs font-semibold text-primary-700 hover:text-primary-900 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            /* Search & Autocomplete Box */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search catalog skills or enter a custom skill
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={onSearchChange}
                    placeholder="e.g. React, Python, Docker, PyTorch, Embedded C..."
                    className="border border-gray-300 rounded-lg px-3.5 py-2.5 w-full text-sm bg-white shadow-xs focus:ring-1 focus:ring-primary-600 focus:border-primary-600 focus:outline-none"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSearchResults([]);
                      }}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Search Dropdown / Results */}
              {searchTerm.trim().length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {/* Option to create custom skill if no exact match */}
                  {!exactMatchExists && (
                    <div
                      onClick={() => setSelectedSkill({ name: searchTerm.trim(), category: 'Custom' })}
                      className="px-3.5 py-2.5 hover:bg-primary-50 cursor-pointer text-sm font-medium text-primary-700 flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <PlusIcon className="h-4 w-4 shrink-0 text-primary-600" />
                        <span>Add &ldquo;<span className="font-bold">{searchTerm.trim()}</span>&rdquo; as a new custom skill</span>
                      </span>
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-md font-medium">Custom</span>
                    </div>
                  )}

                  {filteredResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedSkill(res);
                        setSearchTerm(res.name);
                        setSearchResults([]);
                      }}
                      className="px-3.5 py-2.5 hover:bg-gray-50 cursor-pointer text-sm flex items-center justify-between group"
                    >
                      <span className="font-medium text-gray-900 group-hover:text-primary-700">{res.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md group-hover:bg-primary-50 group-hover:text-primary-800">
                        {res.category}
                      </span>
                    </div>
                  ))}

                  {filteredResults.length === 0 && exactMatchExists && (
                    <div className="px-3.5 py-2 text-xs text-gray-500 italic">
                      This skill is already in your profile.
                    </div>
                  )}
                </div>
              )}

              {/* Initial Suggestions when not typing yet */}
              {!searchTerm && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600">
                      Standard taxonomy suggestions:
                    </span>
                    {isLoadingSuggestions && (
                      <span className="text-2xs text-gray-400">Loading...</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                    {unaddedSuggestions.slice(0, 30).map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => setSelectedSkill(res)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 text-gray-700 border border-gray-200 shadow-2xs transition-colors cursor-pointer"
                      >
                        <span>{res.name}</span>
                        <span className="text-2xs text-gray-400 font-normal">· {res.category}</span>
                      </button>
                    ))}
                    {unaddedSuggestions.length === 0 && !isLoadingSuggestions && (
                      <span className="text-xs text-gray-400">No more suggested skills available. Type above to add a custom skill.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proficiency Level Selector */}
          {selectedSkill && (
            <div className="pt-2 border-t border-gray-200">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Select Your Proficiency Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { level: 'beginner', label: 'Beginner', desc: 'Foundations & basics', dotColor: 'bg-amber-500' },
                  { level: 'intermediate', label: 'Intermediate', desc: 'Practical production', dotColor: 'bg-primary-500' },
                  { level: 'advanced', label: 'Advanced', desc: 'Specialist / system lead', dotColor: 'bg-primary-700' },
                ].map(({ level, label, desc, dotColor }) => {
                  const isSelected = proficiency === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setProficiency(level as any)}
                      className={cn(
                        "flex flex-col items-start text-left p-2.5 rounded-lg border text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-primary-50/50 border-primary-600 shadow-xs text-primary-900"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-gray-900 mb-0.5">
                        <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                        <span>{label}</span>
                      </div>
                      <span className="text-2xs text-gray-500">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedSkill || addSkillMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors shadow-2xs inline-flex items-center gap-1 cursor-pointer"
            >
              {addSkillMutation.isPending ? 'Adding Skill...' : 'Add to Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
