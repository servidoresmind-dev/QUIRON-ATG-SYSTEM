/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { PeriodType, DateRange } from "../../types";

interface PeriodFilterProps {
  id?: string;
  initialType?: PeriodType;
  initialRange?: DateRange;
  onChange: (type: PeriodType, range: DateRange) => void;
  className?: string;
}

export default function PeriodFilter({
  id = "period-filter",
  initialType = "mes",
  initialRange,
  onChange,
  className = "",
}: PeriodFilterProps) {
  const [selectedType, setSelectedType] = useState<PeriodType>(initialType);

  // Default initial range logic helper
  const getPresetRange = (type: PeriodType): DateRange => {
    const todayStr = "2026-06-30"; // Reference current time from metadata
    const today = new Date(`${todayStr}T12:00:00`);

    if (type === "hoje") {
      return { startDate: todayStr, endDate: todayStr };
    } else if (type === "semana") {
      const pastWeek = new Date(today);
      pastWeek.setDate(today.getDate() - 6);
      const pastWeekStr = pastWeek.toISOString().split("T")[0];
      return { startDate: pastWeekStr, endDate: todayStr };
    } else if (type === "mes") {
      // June 1st to June 30th (Reference Year is 2026)
      return { startDate: "2026-06-01", endDate: "2026-06-30" };
    } else {
      // Default custom fallback
      return { startDate: "2026-06-01", endDate: todayStr };
    }
  };

  const [dateRange, setDateRange] = useState<DateRange>(
    initialRange || getPresetRange(initialType)
  );

  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleTypeChange = (type: PeriodType) => {
    setSelectedType(type);
    if (type !== "custom") {
      const range = getPresetRange(type);
      setDateRange(range);
      onChange(type, range);
      setShowDatePicker(false);
    } else {
      setShowDatePicker(true);
    }
  };

  const handleDateChange = (field: "startDate" | "endDate", value: string) => {
    const updatedRange = { ...dateRange, [field]: value };
    setDateRange(updatedRange);
    onChange("custom", updatedRange);
  };

  return (
    <div id={id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${className}`}>
      {/* Selector pills container */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
        {(["hoje", "semana", "mes", "custom"] as const).map((type) => {
          const isActive = selectedType === type;
          const labelMap: Record<PeriodType, string> = {
            hoje: "Hoje",
            semana: "Semana",
            mes: "Mês",
            custom: "Custom",
          };

          return (
            <button
              key={type}
              id={`${id}-btn-${type}`}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-white text-brand-700 shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {labelMap[type]}
            </button>
          );
        })}
      </div>

      {/* Date range pickers (always render inline or show dynamically) */}
      {(selectedType === "custom" || showDatePicker) && (
        <div
          id={`${id}-custom-dates`}
          className="flex items-center gap-2 animate-fade-in bg-white border border-slate-200 p-1.5 rounded-xl shadow-soft"
        >
          <div className="flex items-center gap-1 text-slate-500 pl-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <input
            id={`${id}-start-date`}
            type="date"
            value={dateRange.startDate}
            onChange={(e) => handleDateChange("startDate", e.target.value)}
            className="text-xs font-medium text-slate-700 focus:outline-none bg-transparent"
          />
          <span className="text-xs text-slate-400 font-medium">até</span>
          <input
            id={`${id}-end-date`}
            type="date"
            value={dateRange.endDate}
            onChange={(e) => handleDateChange("endDate", e.target.value)}
            className="text-xs font-medium text-slate-700 focus:outline-none bg-transparent"
            max="2026-06-30"
          />
        </div>
      )}
    </div>
  );
}
