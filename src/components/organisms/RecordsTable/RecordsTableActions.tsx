import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Save, Columns, Settings, Wand2, Filter, Upload, ChevronDown } from "lucide-react";
import { Button } from "../../atoms/Button";
import { ModeSwitcher, type TableMode } from "../../records-table/ModeSwitcher";
import type { Column } from "../../../types/records.types";

export interface TableActionsProps {
  hasChanges: boolean;
  isSaving: boolean;
  selectedRowsCount: number;
  showColumnSelector: boolean;
  onAddRecords: () => void;
  onDiscardChanges: () => void;
  onSaveChanges: () => void;
  onToggleColumnSelector: () => void;
  onShowAISettings: () => void;
  onShowAIBulkDialog: () => void;
  onShowImportJsonDialog?: () => void;
  onShowFilters?: () => void;
  activeFilterCount?: number;
  hasActiveFilters?: boolean;
  mode?: TableMode;
  onModeChange?: (mode: TableMode) => void;
  hideBulk?: boolean;
  displayColumns?: Column[];
  onConfigureAIColumn?: (columnName: string) => void;
}

export function RecordsTableActions({
  hasChanges,
  isSaving,
  selectedRowsCount,
  showColumnSelector,
  onAddRecords,
  onDiscardChanges,
  onSaveChanges,
  onToggleColumnSelector,
  onShowAISettings,
  onShowAIBulkDialog,
  onShowImportJsonDialog,
  onShowFilters,
  activeFilterCount = 0,
  hasActiveFilters = false,
  mode,
  onModeChange,
  hideBulk,
  displayColumns,
  onConfigureAIColumn,
}: TableActionsProps) {
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aiMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setAiMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aiMenuOpen]);

  const aiConfigurableColumns = (displayColumns || []).filter(
    (c) => !c.system && c.type !== "bool" && c.type !== "date" && c.type !== "datetime" && c.type !== "select" && c.type !== "relation",
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onAddRecords}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
        >
          Add Records
        </Button>
        <Button
          onClick={onShowImportJsonDialog}
          variant="secondary"
          icon={<Upload className="w-4 h-4" />}
        >
          Import JSON
        </Button>
        {hasChanges && (
          <Button
            onClick={onDiscardChanges}
            variant="secondary"
            icon={<Trash2 className="w-4 h-4" />}
          >
            Discard Changes
          </Button>
        )}
        <Button
          onClick={onToggleColumnSelector}
          variant={showColumnSelector ? "primary" : "secondary"}
          icon={<Columns className="w-4 h-4" />}
        >
          Columns
        </Button>
        {onShowFilters && (
          <Button
            onClick={onShowFilters}
            variant="secondary"
            icon={<Filter className="w-4 h-4" />}
          >
            Filters
            {activeFilterCount > 0 && (
              <span
                className={`ml-1.5 min-w-[20px] h-5 flex items-center justify-center px-1.5 text-xs font-bold rounded-full ${
                  hasActiveFilters ? "bg-blue-500" : "bg-slate-400"
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
        <Button
          onClick={onShowAISettings}
          variant="primary"
          icon={<Settings className="w-4 h-4" />}
        >
          AI Settings
        </Button>
        {onConfigureAIColumn && aiConfigurableColumns.length > 0 && (
          <div ref={aiMenuRef} className="relative">
            <Button
              onClick={() => setAiMenuOpen((v) => !v)}
              variant="secondary"
              icon={<Wand2 className="w-4 h-4" />}
            >
              Configure AI
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
            {aiMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 min-w-[220px] max-h-[320px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1"
              >
                {aiConfigurableColumns.map((col) => (
                  <button
                    key={col.key}
                    role="menuitem"
                    onClick={() => {
                      setAiMenuOpen(false);
                      onConfigureAIColumn(col.key);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{col.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{col.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {selectedRowsCount > 0 && (
          <Button
            onClick={onShowAIBulkDialog}
            variant="primary"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            icon={<Wand2 className="w-4 h-4" />}
          >
            Generate AI ({selectedRowsCount})
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {mode && onModeChange && (
          <ModeSwitcher mode={mode} onChange={onModeChange} hideBulk={hideBulk} />
        )}
        {hasChanges && (
          <Button
            onClick={onSaveChanges}
            disabled={isSaving}
            loading={isSaving}
            variant="primary"
            icon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        )}
      </div>
    </div>
  );
}
