import React from 'react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'open' | 'closed' | 'admin' | 'member';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    pending: "bg-amber-50 text-amber-800 border border-amber-200",
    approved: "bg-primary-50 text-primary-800 border border-primary-200",
    rejected: "bg-red-50 text-red-800 border border-red-200",
    open: "bg-primary-50 text-primary-800 border border-primary-200",
    closed: "bg-gray-100 text-gray-700 border border-gray-200",
    admin: "bg-primary-50 text-primary-800 border border-primary-200",
    member: "bg-gray-100 text-gray-800 border border-gray-200"
  };

  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    open: "Open",
    closed: "Closed",
    admin: "Admin",
    member: "Member"
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
      styles[status],
      className
    )}>
      {labels[status]}
    </span>
  );
}
