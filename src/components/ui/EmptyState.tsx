/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  id?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export default function EmptyState({
  id = "empty-state",
  title,
  description,
  icon,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      id={id}
      className="flex flex-col items-center justify-center py-12 px-4 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-soft animate-fade-in"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 text-brand-500 mb-4">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <button
          id={`${id}-action-btn`}
          onClick={onAction}
          className="px-4 py-2 bg-brand-500 text-white rounded-xl font-medium text-sm hover:bg-brand-600 transition-colors shadow-soft"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
