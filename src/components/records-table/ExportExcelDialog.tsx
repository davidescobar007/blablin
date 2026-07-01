import { useState, useEffect, useMemo } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Modal } from "../atoms/Modal";
import { Button } from "../atoms/Button";
import { cn } from "../../lib/utils";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { formatRelationValue } from "./utils";

interface ExportExcelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  records: TrackedRecord[];
  selectedRowIds: string[];
  collectionName: string;
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
}

type ExportCell = string | number | boolean;

function formatExportValue(
  col: Column,
  value: unknown,
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>,
): ExportCell {
  if (value === null || value === undefined) return "";

  switch (col.type) {
    case "relation":
      return formatRelationValue(value, col, relationOptions);
    case "bool":
      return Boolean(value);
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isNaN(n) ? "" : n;
    }
    case "select":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "file":
      if (Array.isArray(value)) {
        return value
          .map((f) => (f instanceof File ? f.name : String(f)))
          .join(", ");
      }
      return value instanceof File ? value.name : String(value);
    case "json":
      return typeof value === "object" ? JSON.stringify(value) : String(value);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

function sanitizeSheetName(name: string): string {
  const cleaned = (name || "Sheet1").replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
  return cleaned || "Sheet1";
}

export function ExportExcelDialog({
  isOpen,
  onClose,
  columns,
  records,
  selectedRowIds,
  collectionName,
  relationOptions,
}: ExportExcelDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key)),
  );
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the column selection to "all" whenever the underlying column set
  // changes (collection change / visibility change).
  const columnKeysSig = columns.map((c) => c.key).join("|");
  useEffect(() => {
    setSelectedKeys(new Set(columns.map((c) => c.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKeysSig]);

  const effectiveScope =
    scope === "selected" && selectedRowIds.length > 0 ? "selected" : "all";

  const rowsInScope = useMemo(
    () =>
      effectiveScope === "selected"
        ? records.filter((r) => selectedRowIds.includes(r.id))
        : records,
    [effectiveScope, records, selectedRowIds],
  );

  const selectedCols = columns.filter((c) => selectedKeys.has(c.key));

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (selectedCols.length === 0 || rowsInScope.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      // Loaded on demand so SheetJS isn't bundled into the main chunk.
      const XLSX = await import("xlsx");
      const header = selectedCols.map((c) => c.name);
      const body = rowsInScope.map((r) =>
        selectedCols.map((c) =>
          formatExportValue(c, r.data[c.key], relationOptions),
        ),
      );
      const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(collectionName));
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${collectionName || "export"}_${date}.xlsx`);
      onClose();
    } catch (err) {
      console.error("[Export] Failed to export Excel:", err);
      setError(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export to Excel" size="md">
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Columns</span>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set(columns.map((c) => c.key)))}
                className="text-blue-600 hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeys(new Set())}
                className="text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto border border-slate-200 rounded-lg p-2">
            {columns.map((col) => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.has(col.key)}
                  onChange={() => toggleKey(col.key)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{col.name}</span>
                <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                  {col.type}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-slate-700 block mb-2">
            Rows
          </span>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="export-scope"
                checked={effectiveScope === "all"}
                onChange={() => setScope("all")}
                className="text-blue-600 focus:ring-blue-500"
              />
              All filtered rows ({records.length})
            </label>
            <label
              className={cn(
                "flex items-center gap-2 text-sm",
                selectedRowIds.length === 0
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name="export-scope"
                checked={effectiveScope === "selected"}
                disabled={selectedRowIds.length === 0}
                onChange={() => setScope("selected")}
                className="text-blue-600 focus:ring-blue-500"
              />
              Only selected rows ({selectedRowIds.length})
            </label>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            {selectedCols.length} column{selectedCols.length === 1 ? "" : "s"} ×{" "}
            {rowsInScope.length} row{rowsInScope.length === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleExport}
              loading={exporting}
              disabled={
                selectedCols.length === 0 ||
                rowsInScope.length === 0 ||
                exporting
              }
              icon={<FileSpreadsheet className="w-4 h-4" />}
            >
              Export
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
