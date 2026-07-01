import { useEffect, useRef } from "react";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { getRowStateIndicator } from "./utils";
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

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function getEmptyFieldNames(record: TrackedRecord, columns: Column[]): string[] {
  const empty: string[] = [];
  for (const col of columns) {
    if (col.system) continue;
    if (isEmptyValue(record.data[col.key])) {
      empty.push(col.name);
    }
  }
  return empty;
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
              const emptyFields = getEmptyFieldNames(record, columns);

              return (
                <li
                  key={record.id}
                  className={cn(
                    "flex items-stretch transition-colors border-l-2",
                    isActive
                      ? "bg-blue-100 border-blue-500"
                      : isSelected
                        ? "bg-blue-50 border-blue-300"
                        : idx % 2 === 0
                          ? "bg-slate-50/60 border-transparent"
                          : "border-transparent",
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
                      "flex-1 text-left px-3 py-2.5 transition-colors min-w-0",
                      isActive
                        ? "hover:bg-blue-200/40"
                        : isSelected
                          ? "hover:bg-blue-100/40"
                          : "hover:bg-slate-200/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs truncate font-mono",
                          isActive
                            ? "text-blue-800 font-semibold"
                            : isSelected
                              ? "text-blue-700"
                              : "text-slate-500",
                        )}
                        title={record.id}
                      >
                        {record.id}
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
                    {emptyFields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {emptyFields.map((name) => (
                          <span
                            key={name}
                            title={`Field "${name}" is empty`}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded border border-dashed",
                              isActive
                                ? "text-blue-600 border-blue-300 bg-white/50"
                                : isSelected
                                  ? "text-blue-500 border-blue-200 bg-white/40"
                                  : "text-slate-500 border-slate-300 bg-white/70",
                            )}
                          >
                            <span className={cn(isActive ? "text-blue-400" : "text-slate-400")}>◌</span>
                            {name}
                          </span>
                        ))}
                      </div>
                    )}
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
