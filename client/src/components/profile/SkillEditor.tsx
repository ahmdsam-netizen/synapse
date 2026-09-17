import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';
import { Skill } from '../../types';

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

  const debouncedSearch = useDebounce((term: string) => handleSearch(term), 250);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setErrorMessage(null);
    if (selectedSkill && selectedSkill.name !== val) {
      setSelectedSkill(null);
    }
    debouncedSearch(val);
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
      case 'beginner': return 'bg-amber-400';
      case 'intermediate': return 'bg-blue-500';
      case 'advanced': return 'bg-emerald-500';
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Skills</h3>
          <p className="text-xs text-gray-500 mt-0.5">Showcase your technical and professional expertise</p>
        </div>
        {isOwnProfile && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-semibold hover:bg-primary-50 px-2.5 py-1 rounded-lg transition-colors"
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
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-800 border border-blue-100 shadow-2xs"
            >
              <span
                className={cn("w-2 h-2 rounded-full mr-2 shrink-0", getProficiencyColor(prof))}
                title={`Proficiency: ${prof}`}
              />
              <span>{name}</span>
              <span className="ml-1.5 text-xs text-blue-600/75 capitalize font-normal">
                ({prof})
              </span>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => removeSkillMutation.mutate(id)}
                  disabled={removeSkillMutation.isPending}
                  className="ml-2 text-blue-400 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center font-bold text-xs transition-colors"
                  title="Remove skill"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {skills.length === 0 && !isAdding && (
          <p className="text-gray-500 text-sm italic py-1">No skills added yet. Add skills to get better connection matches!</p>
        )}
      </div>

      {/* Adding Mode */}
      {isAdding && (
        <div className="bg-gray-50/80 p-5 rounded-xl border border-gray-200 space-y-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Add a New Skill</span>
            <button
              onClick={resetForm}
              className="text-xs text-gray-500 hover:text-gray-700"
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
            <div className="flex items-center justify-between bg-primary-50/80 border border-primary-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-700 font-medium uppercase tracking-wide">Selected:</span>
                <span className="font-semibold text-primary-900">{selectedSkill.name}</span>
                {selectedSkill.category && (
                  <span className="text-xs bg-white text-primary-700 border border-primary-200 px-2 py-0.5 rounded-full">
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
                className="text-xs font-semibold text-primary-700 hover:text-primary-900 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            /* Search & Autocomplete Box */
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search existing skills or type your own
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={onSearchChange}
                    placeholder="e.g. React, Python, Docker, UI Design..."
                    className="border border-gray-300 rounded-lg px-3.5 py-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSearchResults([]);
                      }}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Search Dropdown / Results */}
              {searchTerm.trim().length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-md max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {/* Option to create custom skill if no exact match */}
                  {!exactMatchExists && (
                    <div
                      onClick={() => setSelectedSkill({ name: searchTerm.trim(), category: 'Custom' })}
                      className="px-3.5 py-2.5 hover:bg-primary-50 cursor-pointer text-sm font-medium text-primary-700 flex items-center justify-between"
                    >
                      <span>✨ Add &ldquo;<span className="font-bold">{searchTerm.trim()}</span>&rdquo; as a new custom skill</span>
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">Custom</span>
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
                      className="px-3.5 py-2.5 hover:bg-blue-50/70 cursor-pointer text-sm flex items-center justify-between group"
                    >
                      <span className="font-medium text-gray-800 group-hover:text-blue-900">{res.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700">
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
                      Suggested skills to choose from:
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 text-gray-700 border border-gray-200 shadow-2xs transition-colors"
                      >
                        <span>{res.name}</span>
                        <span className="text-2xs text-gray-400 font-normal">· {res.category}</span>
                      </button>
                    ))}
                    {unaddedSuggestions.length === 0 && !isLoadingSuggestions && (
                      <span className="text-xs text-gray-400 italic">No more suggested skills available. Type to add a custom skill!</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proficiency Level Selector */}
          {selectedSkill && (
            <div className="pt-2 border-t border-gray-200/80">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Select Your Proficiency Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { level: 'beginner', label: 'Beginner', desc: 'Learning & basics', dotColor: 'bg-amber-400' },
                  { level: 'intermediate', label: 'Intermediate', desc: 'Comfortable & building', dotColor: 'bg-blue-500' },
                  { level: 'advanced', label: 'Advanced', desc: 'Expert & experienced', dotColor: 'bg-emerald-500' },
                ].map(({ level, label, desc, dotColor }) => {
                  const isSelected = proficiency === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setProficiency(level as any)}
                      className={cn(
                        "flex flex-col items-start text-left p-2.5 rounded-lg border text-xs transition-all",
                        isSelected
                          ? "bg-white border-primary-500 shadow-xs ring-2 ring-primary-500/20"
                          : "bg-white/60 border-gray-200 hover:bg-white hover:border-gray-300"
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
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200/80">
            <button
              type="button"
              onClick={resetForm}
              className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selectedSkill || addSkillMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors shadow-2xs inline-flex items-center gap-1"
            >
              {addSkillMutation.isPending ? 'Adding Skill...' : 'Add to Profile'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
