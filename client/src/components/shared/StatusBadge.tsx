import React from 'react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'open' | 'closed' | 'admin' | 'member';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    open: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
    admin: "bg-purple-100 text-purple-800",
    member: "bg-blue-100 text-blue-800"
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
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      styles[status],
      className
    )}>
      {labels[status]}
    </span>
  );
}
