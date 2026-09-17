import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users';
import { cn } from '../../lib/utils';

interface WorkItemCardProps {
  item: any;
  isOwnProfile: boolean;
  onEdit: () => void;
}

export default function WorkItemCard({ item, isOwnProfile, onEdit }: WorkItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.deleteWorkItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-lg font-semibold text-gray-900">{item.title}</h4>
        
        {isOwnProfile && (
          <div className="flex gap-2 ml-4">
            <button 
              onClick={onEdit}
              className="text-gray-400 hover:text-primary-600 transition-colors"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className={cn("text-sm text-gray-600 whitespace-pre-wrap", !expanded && "line-clamp-3")}>
          {item.description}
        </p>
        {item.description && item.description.length > 150 && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="text-primary-600 hover:text-primary-700 text-xs font-medium mt-1"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {item.tech_used && item.tech_used.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {item.tech_used.map((tech: string, i: number) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
              {tech}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-4">
        {item.repo_url && (
          <a 
            href={item.repo_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Code
          </a>
        )}
        {item.live_url && (
          <a 
            href={item.live_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Live Demo
          </a>
        )}
      </div>
    </div>
  );
}
