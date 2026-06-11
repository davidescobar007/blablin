import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Column } from "./types";
import {
  formatDateForInput,
  parseDateFromInput,
  isValidJSON,
  normalizeAndFormatJSON,
} from "../../utils/formatters";

interface CellPopoverProps {
  open: boolean;
  anchorRect: DOMRect | null;
  column: Column;
  value: unknown;
  onSave: (value: unknown) => void;
  onClose: () => void;
}

export function CellPopover({
  open,
  anchorRect,
  column,
  value,
  onSave,
  onClose,
}: CellPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<unknown>(value);
  const [jsonError, setJsonError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const popoverWidth = 360;
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let left = anchorRect.left;
  let top = anchorRect.bottom + margin;
  if (left + popoverWidth + margin > viewportW) {
    left = Math.max(margin, viewportW - popoverWidth - margin);
  }
  if (top + 280 > viewportH) {
    top = Math.max(margin, anchorRect.top - 280 - margin);
  }

  const commit = () => {
    if (column.type === "json") {
      if (typeof draft === "string" && draft.trim() !== "" && !isValidJSON(draft)) {
        setJsonError(true);
        return;
      }
      const formatted = normalizeAndFormatJSON(draft);
      onSave(formatted);
    } else if (column.type === "number") {
      onSave(draft === "" || draft === null ? null : Number(draft));
    } else if (column.type === "date" || column.type === "datetime") {
      const parsed = parseDateFromInput(String(draft || ""), column.type === "datetime");
      onSave(parsed);
    } else {
      onSave(draft);
    }
    onClose();
  };

  const renderEditor = (): ReactNode => {
    switch (column.type) {
      case "bool":
        return (
          <button
            onClick={() => {
              onSave(!draft);
              onClose();
            }}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              draft ? "bg-blue-600" : "bg-slate-300",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                draft ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        );

      case "number":
        return (
          <input
            type="number"
            autoFocus
            value={draft === null || draft === undefined ? "" : String(draft)}
            onChange={(e) => setDraft(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "date":
        return (
          <input
            type="date"
            autoFocus
            value={formatDateForInput(draft)}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "datetime":
        return (
          <input
            type="datetime-local"
            autoFocus
            value={formatDateForInput(draft, true)}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "select": {
        const options = column.options?.values || [];
        return (
          <select
            autoFocus
            value={String(draft || "")}
            onChange={(e) => setDraft(e.target.value === "" ? null : e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {options.map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case "json":
      case "editor": {
        const display =
          typeof draft === "object" && draft !== null
            ? JSON.stringify(draft, null, 2)
            : String(draft || "");
        return (
          <div className="relative">
            <textarea
              autoFocus
              value={display}
              onChange={(e) => {
                setDraft(e.target.value);
                if (column.type === "json") {
                  setJsonError(e.target.value.trim() !== "" && !isValidJSON(e.target.value));
                }
              }}
              rows={8}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 border",
                jsonError
                  ? "border-red-400 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500",
              )}
            />
            {jsonError && (
              <div className="absolute top-1 right-1 px-2 py-0.5 bg-red-100 rounded text-xs text-red-700 font-medium">
                Invalid JSON
              </div>
            )}
          </div>
        );
      }

      default:
        return (
          <textarea
            autoFocus
            value={typeof draft === "object" ? JSON.stringify(draft, null, 2) : String(draft || "")}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        );
    }
  };

  const showFooter = column.type !== "bool";

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{
        position: "fixed",
        top,
        left,
        width: popoverWidth,
        zIndex: 100,
      }}
      className="bg-white rounded-lg shadow-xl border border-slate-200"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-700 truncate">{column.name}</span>
          <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded flex-shrink-0">
            {column.type}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="p-3">{renderEditor()}</div>
      {showFooter && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={jsonError}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
