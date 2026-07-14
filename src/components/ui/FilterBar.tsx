/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterField {
  key: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  id?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterField[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  rightElement?: React.ReactNode;
}

export default function FilterBar({
  id = "filter-bar",
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  filters = [],
  onClearFilters,
  hasActiveFilters,
  rightElement,
}: FilterBarProps) {
  return (
    <div
      id={id}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-soft mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            id={`${id}-search-input`}
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white focus:border-transparent transition-all duration-200 placeholder-slate-400"
          />
          {searchValue && (
            <button
              id={`${id}-search-clear`}
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic Select Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.length > 0 && (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium mr-1 select-none">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros:</span>
            </div>
          )}

          {filters.map((filter) => (
            <div key={filter.key} className="relative">
              <select
                id={`${id}-select-${filter.key}`}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className={`text-xs font-medium py-2 pl-3 pr-8 rounded-xl border appearance-none focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer transition-colors ${
                  filter.value
                    ? "bg-brand-50 border-brand-200 text-brand-700"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <option value="">Todos ({filter.label})</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          ))}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              id={`${id}-clear-all-btn`}
              onClick={onClearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-dashed border-rose-200"
            >
              <X className="w-3 h-3" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Element (Actions like Excel Export or Add Entry) */}
      {rightElement && (
        <div id={`${id}-right-actions`} className="flex items-center gap-2">
          {rightElement}
        </div>
      )}
    </div>
  );
}
