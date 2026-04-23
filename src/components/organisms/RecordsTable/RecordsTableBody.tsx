import type { Column } from "../../../types/records.types";
import { CellEditor } from "../../records-table/CellEditor";
import { flexRender } from "@tanstack/react-table";
import { getRowStateColor } from "../../records-table/utils";

export interface TableBodyProps {
  table: any; // TanStack Table instance with complex types
  displayColumns: Column[];
  updateCell: (rowId: string, field: string, value: unknown) => void;
  client: any; // PocketBase client
  relationOptions: Record<string, { id: string; [key: string]: unknown }[]>;
  loadRelationOptions: (collectionId: string) => void;
  onCellFocus: (recordId: string, field: string, value: unknown, column: Column) => void;
  onGenerateAI: (recordId: string, columnName: string) => void;
  aiGenerating: Record<string, boolean>;
  expandedCells: Record<string, boolean>;
  setExpandedCells: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function RecordsTableBody({
  table,
  displayColumns,
  updateCell,
  client,
  relationOptions,
  loadRelationOptions,
  onCellFocus,
  onGenerateAI,
  aiGenerating,
  expandedCells,
  setExpandedCells,
}: TableBodyProps) {
  return (
    <tbody className="divide-y divide-slate-200">
      {table.getRowModel().rows.map((row: any) => (
        <tr
          key={row.id}
          className={`border border-slate-200 ${getRowStateColor(
            row.original.state,
            !!row.original.error,
          )}`}
        >
          {row.getVisibleCells().map((cell: any) => {
            const cellClassName = cell.column.columnDef.meta?.cellClassName || "px-4 py-2";
            const isSelectColumn = cell.column.id === "select";
            const displayColumn = displayColumns.find(col => col.key === cell.column.id);
            const hasFieldChange = !isSelectColumn && displayColumn && row.original.changes?.[cell.column.id];

            return (
              <td
                key={cell.id}
                className={`${cellClassName} text-sm text-slate-700`}
                style={{ width: cell.column.getSize() }}
              >
                {isSelectColumn ? (
                  flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  )
                ) : displayColumn ? (
                  <div className="relative">
                    {hasFieldChange && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    )}
                    <CellEditor
                      record={row.original}
                      column={displayColumn}
                      value={row.original.data[displayColumn.key]}
                      isExpanded={expandedCells[`${row.original.id}-${displayColumn.key}`]}
                      onToggleExpand={() => {
                        const cellKey = `${row.original.id}-${displayColumn.key}`;
                        setExpandedCells((prev: Record<string, boolean>) => ({
                          ...prev,
                          [cellKey]: !prev[cellKey],
                        }));
                      }}
                      onUpdate={(newValue: unknown) => {
                        updateCell(row.original.id, displayColumn.key, newValue);
                      }}
                      onCellFocus={onCellFocus}
                      onLoadRelationOptions={loadRelationOptions}
                      relationOptions={relationOptions}
                      onGenerateAI={onGenerateAI}
                      aiGenerating={aiGenerating}
                      client={client}
                    />
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
