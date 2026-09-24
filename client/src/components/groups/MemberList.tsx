import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid';
import { StatusBadge } from '../shared/StatusBadge';
import { getInitials, formatDate } from '../../lib/utils';

export interface MemberItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'admin' | 'member';
  joinedAt: string;
}

interface MemberListProps {
  members: MemberItem[];
  currentUserRole?: 'admin' | 'member' | null;
  onPromote?: (userId: string) => void;
  onRemove?: (userId: string) => void;
}

export function MemberList({ members, currentUserRole, onPromote, onRemove }: MemberListProps) {
  if (!members || members.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No members found in this group.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100">
      {members.map((member: any) => {
        const avatar = member.avatarUrl || member.avatar_url;
        const joined = member.joinedAt || member.joined_at;
        const role = member.role || 'member';

        return (
          <li key={member.id} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
                {avatar ? (
                  <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  getInitials(member.name || '')
                )}
              </div>
              <div>
                <Link to={`/profile/${member.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
                  {member.name}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {joined ? `Joined ${formatDate(joined)}` : 'Member'}
                  </span>
                  {role === 'admin' && (
                    <StatusBadge status="admin" className="!px-1.5 !py-0 !text-[10px]" />
                  )}
                </div>
              </div>
            </div>

            {currentUserRole === 'admin' && role !== 'admin' && (
              <Menu as="div" className="relative inline-block text-left">
              <MenuButton className="flex items-center rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none">
                <span className="sr-only">Open options</span>
                <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
              </MenuButton>

              <MenuItems className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                <div className="py-1">
                  {onPromote && (
                    <MenuItem>
                      <button
                        onClick={() => onPromote(member.id)}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900"
                      >
                        Promote to Admin
                      </button>
                    </MenuItem>
                  )}
                  {onRemove && (
                    <MenuItem>
                      <button
                        onClick={() => onRemove(member.id)}
                        className="block w-full px-4 py-2 text-left text-sm text-red-600 data-[focus]:bg-red-50"
                      >
                        Remove from group
                      </button>
                    </MenuItem>
                  )}
                </div>
              </MenuItems>
            </Menu>
          )}
        </li>
      );
    })}
    </ul>
  );
}
