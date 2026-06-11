import { useState, useCallback } from "react";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { CellPopover } from "./CellPopover";
import { getRowStateColor, formatCellValue, getRowStateIndicator } from "./utils";
import { cn } from "../../lib/utils";

interface BulkTableViewProps {
  records: TrackedRecord[];
  columns: Column[];
  selectedRows: string[];
  onToggleRowSelect: (rowId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onUpdateCell: (rowId: string, field: string, value: unknown) => void;
  aiGenerating?: Record<string, boolean>;
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
  className,
}: BulkTableViewProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);

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
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span>{col.name}</span>
                    <span className="text-slate-400 font-normal normal-case">
                      ({col.type})
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {records.map((record) => {
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
                    const isEmpty = rawValue === null || rawValue === undefined || rawValue === "";
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
                              {truncate(formatCellValue(rawValue), 60)}
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
    return <span className="text-xs text-slate-400 font-mono truncate block">{record.id.slice(0, 6)}</span>;
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
