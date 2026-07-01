import { useState, useCallback, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { CellPopover } from "./CellPopover";
import {
  getRowStateColor,
  formatCellValue,
  formatRelationValue,
  getRowStateIndicator,
} from "./utils";
import { cn } from "../../lib/utils";

interface BulkTableViewProps {
  records: TrackedRecord[];
  columns: Column[];
  selectedRows: string[];
  onToggleRowSelect: (rowId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onUpdateCell: (rowId: string, field: string, value: unknown) => void;
  aiGenerating?: Record<string, boolean>;
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
  className?: string;
}

interface PopoverState {
  recordId: string;
  columnKey: string;
  rect: DOMRect;
  value: unknown;
}

export function BulkTableView({
  records,
  columns,
  selectedRows,
  onToggleRowSelect,
  onSelectAll,
  onUpdateCell,
  aiGenerating,
  relationOptions,
  className,
}: BulkTableViewProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleSort = useCallback((key: string) => {
    // Cycle: unsorted -> asc -> desc -> unsorted
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  const sortedRecords = useMemo(() => {
    if (!sortConfig) return records;
    const col = columns.find((c) => c.key === sortConfig.key);
    if (!col) return records;
    const dir = sortConfig.direction === "asc" ? 1 : -1;

    const toKey = (
      record: TrackedRecord,
    ): { empty: boolean; value: number | string } => {
      const raw = record.data[col.key];
      const empty =
        raw === null ||
        raw === undefined ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0);
      if (empty) return { empty: true, value: "" };

      if (col.type === "number") {
        const n = Number(raw);
        return Number.isNaN(n)
          ? { empty: true, value: "" }
          : { empty: false, value: n };
      }
      if (col.type === "date" || col.type === "datetime") {
        const t = Date.parse(String(raw));
        return Number.isNaN(t)
          ? { empty: true, value: "" }
          : { empty: false, value: t };
      }
      if (col.type === "bool") {
        return { empty: false, value: raw ? 1 : 0 };
      }
      if (col.type === "relation") {
        return {
          empty: false,
          value: formatRelationValue(raw, col, relationOptions).toLowerCase(),
        };
      }
      return { empty: false, value: formatCellValue(raw).toLowerCase() };
    };

    return [...records].sort((a, b) => {
      const ka = toKey(a);
      const kb = toKey(b);
      // Empty values always sort last, regardless of direction
      if (ka.empty && kb.empty) return 0;
      if (ka.empty) return 1;
      if (kb.empty) return -1;
      if (typeof ka.value === "number" && typeof kb.value === "number") {
        return (ka.value - kb.value) * dir;
      }
      return String(ka.value).localeCompare(String(kb.value)) * dir;
    });
  }, [records, columns, sortConfig, relationOptions]);

  const handleCellClick = useCallback(
    (e: React.MouseEvent, record: TrackedRecord, column: Column) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      setPopover({
        recordId: record.id,
        columnKey: column.key,
        rect: target.getBoundingClientRect(),
        value: record.data[column.key],
      });
    },
    [],
  );

  const popoverColumn = popover
    ? columns.find((c) => c.key === popover.columnKey)
    : null;
  const popoverRecord = popover
    ? records.find((r) => r.id === popover.recordId)
    : null;

  const allSelected = records.length > 0 && selectedRows.length === records.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < records.length;

  return (
    <div className={cn("border border-slate-200 rounded-lg overflow-hidden bg-white", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  autoComplete="off"
                  data-form-type="other"
                  aria-label="Select all rows"
                />
              </th>
              <th className="sticky left-10 z-10 bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                State
              </th>
              {columns.map((col) => {
                const sorted =
                  sortConfig?.key === col.key ? sortConfig.direction : null;
                return (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="group flex items-center gap-1 uppercase tracking-wider hover:text-slate-700 transition-colors"
                      title={`Sort by ${col.name}`}
                    >
                      <span>{col.name}</span>
                      <span className="text-slate-400 font-normal normal-case">
                        ({col.type})
                      </span>
                      {sorted === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                      ) : sorted === "desc" ? (
                        <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedRecords.map((record) => {
              const isSelected = selectedRows.includes(record.id);
              return (
                <tr
                  key={record.id}
                  className={cn(
                    "hover:bg-slate-50 transition-colors",
                    isSelected && "bg-blue-50/50",
                    getRowStateColor(record.state, !!record.error),
                  )}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        onToggleRowSelect(record.id, e.target.checked)
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      autoComplete="off"
                      data-form-type="other"
                      aria-label={`Select row ${record.id}`}
                    />
                  </td>
                  <td className="sticky left-10 z-10 bg-inherit px-3 py-2 w-24">
                    <RowStateBadge record={record} />
                  </td>
                  {columns.map((col) => {
                    const rawValue = record.data[col.key];
                    const displayValue =
                      col.type === "relation"
                        ? formatRelationValue(rawValue, col, relationOptions)
                        : formatCellValue(rawValue);
                    const isEmpty = displayValue === "";
                    const isGenerating = aiGenerating?.[`${record.id}-${col.key}`];
                    return (
                      <td
                        key={col.key}
                        onClick={(e) => handleCellClick(e, record, col)}
                        className={cn(
                          "px-3 py-2 cursor-pointer max-w-xs",
                          "hover:bg-blue-50 transition-colors align-top",
                        )}
                        title="Click to edit"
                      >
                        <div className="truncate">
                          {isGenerating ? (
                            <span className="inline-flex items-center gap-1 text-purple-600 text-xs">
                              <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                              generating…
                            </span>
                          ) : isEmpty ? (
                            <span className="text-slate-400 italic text-xs">empty</span>
                          ) : (
                            <span className="text-slate-700">
                              {truncate(displayValue, 60)}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {popover && popoverColumn && popoverRecord && (
        <CellPopover
          key={`${popoverRecord.id}-${popoverColumn.key}`}
          open={true}
          anchorRect={popover.rect}
          column={popoverColumn}
          value={popover.value}
          relationOptions={relationOptions}
          onSave={(newValue) => {
            onUpdateCell(popoverRecord.id, popoverColumn.key, newValue);
          }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + "…";
}

function RowStateBadge({ record }: { record: TrackedRecord }) {
  const indicator = getRowStateIndicator(record.state, !!record.error);
  if (!indicator) {
    // Row has no pending change — show a neutral marker instead of the ID
    // (the ID column already shows the record identifier).
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-slate-400"
        title="No pending changes"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        {record.state === "saved" ? "Saved" : "—"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
        indicator.bgClass,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", indicator.color)} />
      {indicator.label}
    </span>
  );
}
