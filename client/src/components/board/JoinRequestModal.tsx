import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '../shared/Modal';
import { boardsApi } from '../../api/boards';
import { BoardPosting } from '../../types';

interface JoinRequestModalProps {
  open: boolean;
  onClose: () => void;
  posting: BoardPosting;
}

export function JoinRequestModal({ open, onClose, posting }: JoinRequestModalProps) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: (msg: string) => boardsApi.submitJoinRequest(posting.id, msg),
    onSuccess: () => {
      toast.success('Request sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['board'] });
      queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send request');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate(message);
  };

  return (
    <Modal open={open} onClose={onClose} title={`Request to join ${posting.groupName || 'group'}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="message" className="block text-sm font-medium leading-6 text-gray-900">
            Message (Optional)
          </label>
          <div className="mt-2">
            <textarea
              id="message"
              name="message"
              rows={4}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Why do you want to join?"
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 p-2"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 text-right">
            {message.length} / 500
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="inline-flex justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50"
          >
            {submitMutation.isPending ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
