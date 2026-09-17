import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { useDebounce } from '../../hooks/useDebounce';
import { Interest } from '../../types';

interface InterestEditorProps {
  interests: any[];
  isOwnProfile: boolean;
}

export default function InterestEditor({ interests, isOwnProfile }: InterestEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Interest[]>([]);
  const [allSuggestions, setAllSuggestions] = useState<Interest[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const addInterestMutation = useMutation({
    mutationFn: (data: { interestId?: string; name?: string }) => usersApi.addInterest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      resetForm();
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || 'Failed to add interest. Please try again.');
    }
  });

  const removeInterestMutation = useMutation({
    mutationFn: (interestId: string) => usersApi.removeInterest(interestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  });

  // Load initial suggestions when adding mode is toggled
  useEffect(() => {
    if (!isAdding) return;
    let isMounted = true;
    setIsLoadingSuggestions(true);
    usersApi.searchInterests('')
      .then((res) => {
        if (!isMounted) return;
        const raw = (res.data as any)?.data || (res.data as any)?.interests || res.data || [];
        setAllSuggestions(Array.isArray(raw) ? raw : []);
      })
      .catch((e) => console.error('Failed to load initial interests', e))
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
      const results = await usersApi.searchInterests(term.trim());
      const raw = (results.data as any)?.data || (results.data as any)?.interests || results.data || [];
      setSearchResults(Array.isArray(raw) ? raw : []);
    } catch (e) {
      console.error('Failed to search interests', e);
    }
  };

  const debouncedSearch = useDebounce((term: string) => handleSearch(term), 250);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setErrorMessage(null);
    debouncedSearch(val);
  };

  const resetForm = () => {
    setIsAdding(false);
    setSearchTerm('');
    setSearchResults([]);
    setErrorMessage(null);
  };

  const selectInterest = (interest: { id?: string; name: string }) => {
    setErrorMessage(null);
    addInterestMutation.mutate({ interestId: interest.id, name: interest.name });
  };

  // Filter out already added interests
  const addedInterestNames = new Set(
    interests.map((i) => (i.name || i.interest?.name || '').toLowerCase())
  );
  const addedInterestIds = new Set(
    interests.map((i) => i.id || i.interest_id)
  );

  const isAlreadyAdded = (item: Interest) =>
    addedInterestIds.has(item.id) || addedInterestNames.has(item.name.toLowerCase());

  const unaddedSuggestions = allSuggestions.filter((i) => !isAlreadyAdded(i));
  const filteredResults = searchResults.filter((i) => !isAlreadyAdded(i));

  const exactMatchExists = searchResults.some(
    (i) => i.name.toLowerCase() === searchTerm.trim().toLowerCase()
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Interests</h3>
          <p className="text-xs text-gray-500 mt-0.5">Connect with peers who share your passions and fields</p>
        </div>
        {isOwnProfile && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-semibold hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors"
          >
            + Add Interest
          </button>
        )}
      </div>

      {/* Current User Interests */}
      <div className="flex flex-wrap gap-2 mb-4">
        {interests.map((i) => {
          const id = i.id || i.interest_id;
          const name = i.name || i.interest?.name;
          return (
            <div
              key={id || name}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-100 shadow-2xs"
            >
              <span>{name}</span>
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => removeInterestMutation.mutate(id)}
                  disabled={removeInterestMutation.isPending}
                  className="ml-2 text-emerald-500 hover:text-red-500 rounded-full w-4 h-4 flex items-center justify-center font-bold text-xs transition-colors"
                  title="Remove interest"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {interests.length === 0 && !isAdding && (
          <p className="text-gray-500 text-sm italic py-1">No interests added yet. Add interests to discover shared campus circles!</p>
        )}
      </div>

      {/* Adding Mode */}
      {isAdding && (
        <div className="bg-gray-50/80 p-5 rounded-xl border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Add an Interest</span>
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

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Search interests or type your own
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={onSearchChange}
                  placeholder="e.g. Artificial Intelligence, Blockchain, Hackathons..."
                  className="border border-gray-300 rounded-lg px-3.5 py-2.5 w-full text-sm bg-white shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
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
                {!exactMatchExists && (
                  <div
                    onClick={() => selectInterest({ name: searchTerm.trim() })}
                    className="px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm font-medium text-emerald-700 flex items-center justify-between"
                  >
                    <span>✨ Add &ldquo;<span className="font-bold">{searchTerm.trim()}</span>&rdquo; as a new custom interest</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Custom</span>
                  </div>
                )}

                {filteredResults.map((res) => (
                  <div
                    key={res.id}
                    onClick={() => selectInterest(res)}
                    className="px-3.5 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm flex items-center justify-between group"
                  >
                    <span className="font-medium text-gray-800 group-hover:text-emerald-900">{res.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full group-hover:bg-emerald-100 group-hover:text-emerald-700">
                      {res.category}
                    </span>
                  </div>
                ))}

                {filteredResults.length === 0 && exactMatchExists && (
                  <div className="px-3.5 py-2 text-xs text-gray-500 italic">
                    This interest is already in your profile.
                  </div>
                )}
              </div>
            )}

            {/* Initial Suggestions when not typing */}
            {!searchTerm && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600">
                    Click to add suggested interests:
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
                      onClick={() => selectInterest(res)}
                      disabled={addInterestMutation.isPending}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-gray-700 border border-gray-200 shadow-2xs transition-colors"
                    >
                      <span>+ {res.name}</span>
                      <span className="text-2xs text-gray-400 font-normal">· {res.category}</span>
                    </button>
                  ))}
                  {unaddedSuggestions.length === 0 && !isLoadingSuggestions && (
                    <span className="text-xs text-gray-400 italic">No more suggested interests. Type to add a custom interest!</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
