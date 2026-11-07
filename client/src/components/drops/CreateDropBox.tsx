import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dropsApi } from '../../api/drops';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../lib/utils';

export function CreateDropBox() {
  const [content, setContent] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (text: string) => dropsApi.createDrop(text),
    onSuccess: () => {
      toast.success('Drop published!');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['drops'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to post drop');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Drop content cannot be empty');
      return;
    }
    if (trimmed.length > 500) {
      toast.error('Drop cannot exceed 500 characters');
      return;
    }
    createMutation.mutate(trimmed);
  };

  const remaining = 500 - content.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 border border-primary-200 text-primary-800 font-bold text-xs">
            {getInitials(user?.name || 'Student')}
          </div>
          <div className="flex-1">
            <textarea
              rows={3}
              maxLength={500}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post a student update, project milestone, or quick engineering thought..."
              className="block w-full resize-none rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-600 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <span className={`text-xs ${remaining < 50 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
            {content.length} / 500
          </span>
          <button
            type="submit"
            disabled={createMutation.isPending || !content.trim()}
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {createMutation.isPending ? 'Publishing...' : 'Drop Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
