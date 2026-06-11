import { useEffect, useRef } from "react";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { getRowStateIndicator, formatCellValue } from "./utils";
import { cn } from "../../lib/utils";

interface MasterDetailViewProps {
  records: TrackedRecord[];
  columns: Column[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  selectedRows: string[];
  onToggleRowSelect: (rowId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  renderDetail: () => React.ReactNode;
  className?: string;
}

function getPrimaryDisplayValue(record: TrackedRecord, columns: Column[]): string {
  for (const col of columns) {
    if (col.key === "id" || col.system) continue;
    const value = record.data[col.key];
    if (value !== null && value !== undefined && value !== "") {
      const str = formatCellValue(value);
      if (str.length > 0) return str;
    }
  }
  return record.id;
}

function getSecondaryDisplayValue(record: TrackedRecord, columns: Column[]): string {
  let count = 0;
  for (const col of columns) {
    if (col.key === "id" || col.system) continue;
    const value = record.data[col.key];
    if (value !== null && value !== undefined && value !== "") {
      count++;
      if (count === 2) {
        return formatCellValue(value);
      }
    }
  }
  return "";
}

export function MasterDetailView({
  records,
  columns,
  selectedIndex,
  onSelectIndex,
  selectedRows,
  onToggleRowSelect,
  onSelectAll,
  renderDetail,
  className,
}: MasterDetailViewProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const allSelected = records.length > 0 && selectedRows.length === records.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < records.length;

  return (
    <div className={cn("flex flex-col md:flex-row gap-4 h-full", className)}>
      <div
        ref={listRef}
        className="w-full md:w-80 lg:w-96 flex-shrink-0 border border-slate-200 rounded-lg bg-white overflow-y-auto md:max-h-[calc(100vh-220px)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              autoComplete="off"
              data-form-type="other"
              aria-label="Select all rows"
            />
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              Rows ({records.length})
            </span>
          </label>
          {selectedRows.length > 0 && (
            <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              {selectedRows.length} selected
            </span>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No records
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {records.map((record, idx) => {
              const isActive = idx === selectedIndex;
              const isSelected = selectedRows.includes(record.id);
              const stateIndicator = getRowStateIndicator(record.state, !!record.error);
              const primary = getPrimaryDisplayValue(record, columns);
              const secondary = getSecondaryDisplayValue(record, columns);

              return (
                <li
                  key={record.id}
                  className={cn(
                    "flex items-stretch",
                    isActive && "bg-blue-50",
                  )}
                >
                  <label
                    className="flex items-center justify-center px-3 cursor-pointer border-r border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onToggleRowSelect(record.id, e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      autoComplete="off"
                      data-form-type="other"
                      aria-label={`Select row ${record.id}`}
                    />
                  </label>
                  <button
                    ref={isActive ? activeItemRef : null}
                    onClick={() => onSelectIndex(idx)}
                    className={cn(
                      "flex-1 text-left px-3 py-2.5 hover:bg-slate-50 transition-colors min-w-0",
                      isActive && "hover:bg-blue-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-blue-900" : "text-slate-800",
                        )}
                        title={primary}
                      >
                        {primary}
                      </span>
                      {stateIndicator && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0",
                            stateIndicator.bgClass,
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              stateIndicator.color,
                            )}
                          />
                          {stateIndicator.label}
                        </span>
                      )}
                    </div>
                    {secondary && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {secondary}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 truncate font-mono mt-0.5">
                      {record.id}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex-1 min-w-0 border border-slate-200 rounded-lg bg-white overflow-hidden">
        {renderDetail()}
      </div>
    </div>
  );
}
