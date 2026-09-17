import { useState, useEffect } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import toast from 'react-hot-toast';

interface WorkItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export default function WorkItemForm({ isOpen, onClose, initialData }: WorkItemFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tech_used: '',
    repo_url: '',
    live_url: '',
    media_url: '',
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          description: initialData.description || '',
          tech_used: initialData.tech_used ? initialData.tech_used.join(', ') : '',
          repo_url: initialData.repo_url || '',
          live_url: initialData.live_url || '',
          media_url: initialData.media_url || '',
        });
      } else {
        setFormData({
          title: '',
          description: '',
          tech_used: '',
          repo_url: '',
          live_url: '',
          media_url: '',
        });
      }
    }
  }, [isOpen, initialData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        tech_used: data.tech_used.split(',').map((t: string) => t.trim()).filter(Boolean)
      };
      return initialData 
        ? usersApi.updateWorkItem(initialData.id, payload)
        : usersApi.createWorkItem(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      toast.success(initialData ? 'Project updated' : 'Project added');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save project');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <DialogTitle className="text-xl font-bold text-gray-900 mb-4">
            {initialData ? 'Edit Project' : 'Add Project'}
          </DialogTitle>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Project Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-24 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="What did you build?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack</label>
              <input
                type="text"
                value={formData.tech_used}
                onChange={(e) => setFormData({...formData, tech_used: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="React, Node.js, TypeScript (comma separated)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
                <input
                  type="url"
                  value={formData.repo_url}
                  onChange={(e) => setFormData({...formData, repo_url: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://github.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Live Demo URL</label>
                <input
                  type="url"
                  value={formData.live_url}
                  onChange={(e) => setFormData({...formData, live_url: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
