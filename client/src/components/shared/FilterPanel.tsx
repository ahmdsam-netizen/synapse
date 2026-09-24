import React, { useState, useEffect, useMemo } from 'react';
import { SearchFilters } from '../../api/search';
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface FilterPanelProps {
  filters: SearchFilters;
  onChange?: (filters: SearchFilters) => void;
  onApply?: (filters: SearchFilters) => void;
  onClear?: () => void;
  isSearching?: boolean;
}

const POPULAR_SKILLS = [
  'React',
  'Node.js',
  'TypeScript',
  'Python',
  'Docker',
  'PostgreSQL',
  'Tailwind CSS',
  'Machine Learning',
];

export function FilterPanel({ filters, onChange, onApply, onClear, isSearching }: FilterPanelProps) {
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(filters || {});
  const [customSkillInput, setCustomSkillInput] = useState('');

  // Sync draft state if external filters change
  useEffect(() => {
    setDraftFilters(filters || {});
  }, [filters]);

  const updateDraft = (key: keyof SearchFilters, value: any) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    if (onApply) {
      onApply(draftFilters);
    } else if (onChange) {
      onChange(draftFilters);
    }
  };

  const clearFilters = () => {
    const empty: SearchFilters = {};
    setDraftFilters(empty);
    setCustomSkillInput('');
    if (onClear) {
      onClear();
    } else if (onApply) {
      onApply(empty);
    } else if (onChange) {
      onChange(empty);
    }
  };

  const currentSkills: string[] = draftFilters.skills || [];

  const toggleSkill = (skill: string) => {
    if (currentSkills.includes(skill)) {
      updateDraft(
        'skills',
        currentSkills.filter((s) => s !== skill)
      );
    } else {
      updateDraft('skills', [...currentSkills, skill]);
    }
  };

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSkillInput.trim();
    if (trimmed && !currentSkills.includes(trimmed)) {
      updateDraft('skills', [...currentSkills, trimmed]);
      setCustomSkillInput('');
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draftFilters.college || draftFilters.collegeId) count++;
    if (draftFilters.year) count++;
    if (draftFilters.lookingFor) count++;
    if (draftFilters.skills && draftFilters.skills.length > 0) count += draftFilters.skills.length;
    if (draftFilters.matchMode === 'all') count++;
    return count;
  }, [draftFilters]);

  const hasUnappliedChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(filters);
  }, [draftFilters, filters]);

  const hasActiveFilters = Boolean(
    draftFilters.college ||
    draftFilters.collegeId ||
    draftFilters.year ||
    draftFilters.lookingFor ||
    (draftFilters.skills && draftFilters.skills.length > 0) ||
    draftFilters.matchMode === 'all'
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
      {/* Top Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* College Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">College</label>
          <input 
            type="text" 
            placeholder="e.g. Stanford, IIT, MIT..."
            className="w-full text-sm border-gray-300 rounded-md shadow-xs focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 border"
            value={draftFilters.college || draftFilters.collegeId || ''}
            onChange={(e) => {
              const val = e.target.value.trim() || undefined;
              setDraftFilters((prev) => ({ ...prev, college: val, collegeId: val }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
            }}
          />
        </div>

        {/* Year Dropdown Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <select
            className="w-full text-sm border-gray-300 rounded-md shadow-xs focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 border bg-white"
            value={draftFilters.year || ''}
            onChange={(e) => updateDraft('year', e.target.value ? parseInt(e.target.value, 10) : undefined)}
          >
            <option value="">Any Year</option>
            {[1, 2, 3, 4, 5, 6].map(y => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
        </div>

        {/* Looking For Dropdown Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Looking For</label>
          <select
            className="w-full text-sm border-gray-300 rounded-md shadow-xs focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 border bg-white"
            value={draftFilters.lookingFor || ''}
            onChange={(e) => updateDraft('lookingFor', e.target.value || undefined)}
          >
            <option value="">Any Intent</option>
            <option value="project">Project</option>
            <option value="event">Event</option>
            <option value="both">Both</option>
          </select>
        </div>
        
        {/* Match Mode Toggle */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Skill Match</label>
          <select
            className="w-full text-sm border-gray-300 rounded-md shadow-xs focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 border bg-white"
            value={draftFilters.matchMode || 'any'}
            onChange={(e) => updateDraft('matchMode', e.target.value as 'any' | 'all')}
          >
            <option value="any">Match Any</option>
            <option value="all">Match All</option>
          </select>
        </div>
      </div>

      {/* Skills filter section */}
      <div className="border-t border-gray-100 pt-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <label className="block text-xs font-medium text-gray-700">Filter by Skills</label>
          <form onSubmit={handleAddCustomSkill} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="Add skill tag..."
              value={customSkillInput}
              onChange={(e) => setCustomSkillInput(e.target.value)}
              className="text-xs border border-gray-300 rounded-md px-2.5 py-1 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-36"
            />
            <button
              type="submit"
              disabled={!customSkillInput.trim()}
              className="inline-flex items-center gap-0.5 rounded-md bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
            >
              <PlusIcon className="h-3 w-3" />
              <span>Add</span>
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {POPULAR_SKILLS.map((skill) => {
            const isSelected = currentSkills.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border ${
                  isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span>{skill}</span>
                {isSelected && <XMarkIcon className="h-3 w-3" />}
              </button>
            );
          })}

          {/* Any custom added skills not in popular list */}
          {currentSkills
            .filter((s) => !POPULAR_SKILLS.includes(s))
            .map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-primary-600 text-white border border-primary-600 shadow-xs"
              >
                <span>{skill}</span>
                <XMarkIcon className="h-3 w-3" />
              </button>
            ))}
        </div>
      </div>

      {/* Bottom Footer Action Bar - The single search button */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          {hasUnappliedChanges ? (
            <span className="text-amber-600 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Options modified - click Search to apply
            </span>
          ) : activeFilterCount > 0 ? (
            <span className="text-gray-600 font-medium">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied
            </span>
          ) : (
            <span className="text-gray-400">Choose filter options above and click Search</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-red-600 px-3 py-1.5 font-medium transition-colors cursor-pointer"
            >
              Clear filters
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            disabled={isSearching}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer",
              hasUnappliedChanges
                ? "bg-primary-600 hover:bg-primary-700 ring-2 ring-primary-500/30"
                : "bg-primary-600 hover:bg-primary-700"
            )}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-2xs bg-white/20 text-white font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
