import { Wand2, X, Copy, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onGenerateAI: () => void;
  onApplyValue?: () => void;
  onDelete?: () => void;
  isGenerating?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  onGenerateAI,
  onApplyValue,
  onDelete,
  isGenerating,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 flex flex-wrap items-center gap-2 px-3 py-2.5 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]",
        "rounded-t-lg",
        className,
      )}
      role="region"
      aria-label="Bulk actions"
    >
      <div className="flex items-center gap-2 mr-2">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"
          aria-label={`${selectedCount} of ${totalCount} selected`}
        >
          {selectedCount}/{totalCount}
        </span>
        <span className="text-sm text-slate-600 hidden sm:inline">
          {selectedCount === 1 ? "row" : "rows"} selected
        </span>
        <button
          onClick={onClearSelection}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 flex-wrap">
        {onApplyValue && (
          <button
            onClick={onApplyValue}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Apply value</span>
            <span className="sm:hidden">Apply</span>
          </button>
        )}

        <button
          onClick={onGenerateAI}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-md transition-colors disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>AI ({selectedCount})</span>
        </button>

        {onDelete && (
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete selected rows"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}
      </div>
    </div>
  );
}
