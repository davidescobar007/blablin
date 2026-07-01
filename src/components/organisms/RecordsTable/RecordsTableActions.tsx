import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import {
  Plus,
  Trash2,
  Save,
  Columns,
  Settings,
  Sparkles,
  Wand2,
  Filter,
  Upload,
  FileSpreadsheet,
  Database,
  Eye,
  ChevronDown,
} from "lucide-react";
import { Button } from "../../atoms/Button";
import { cn } from "../../../lib/utils";
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
  onShowExport?: () => void;
  onShowFilters?: () => void;
  activeFilterCount?: number;
  hasActiveFilters?: boolean;
  mode?: TableMode;
  onModeChange?: (mode: TableMode) => void;
  hideBulk?: boolean;
  displayColumns?: Column[];
  onConfigureAIColumn?: (columnName: string) => void;
}

/**
 * Lightweight dropdown with outside-click handling.
 * `trigger` renders the toggle button; `children` receives a `close` fn.
 */
interface DropdownProps {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
}

function Dropdown({ trigger, children, align = "left", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger(open, toggle)}
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute mt-1 min-w-[220px] max-h-[360px] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, hint, disabled, onClick }: MenuItemProps) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
        disabled
          ? "text-slate-300 cursor-not-allowed"
          : "text-slate-700 hover:bg-slate-50",
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && (
        <span className="text-xs text-slate-400 flex-shrink-0">{hint}</span>
      )}
    </button>
  );
}

function FilterBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "min-w-[18px] h-[18px] inline-flex items-center justify-center px-1 text-[11px] font-bold rounded-full text-white",
        active ? "bg-blue-500" : "bg-slate-400",
      )}
    >
      {count}
    </span>
  );
}

const chevronCls = "w-3 h-3 ml-0.5 transition-transform";

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
  onShowExport,
  onShowFilters,
  activeFilterCount = 0,
  hasActiveFilters = false,
  mode,
  onModeChange,
  hideBulk,
  displayColumns,
  onConfigureAIColumn,
}: TableActionsProps) {
  const aiConfigurableColumns = (displayColumns || []).filter(
    (c) =>
      !c.system &&
      c.type !== "bool" &&
      c.type !== "date" &&
      c.type !== "datetime" &&
      c.type !== "select" &&
      c.type !== "relation",
  );

  const canConfigureAI =
    Boolean(onConfigureAIColumn) && aiConfigurableColumns.length > 0;
  const hasDataMenu = Boolean(onShowImportJsonDialog || onShowExport);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* LEFT CLUSTER — primary action + grouped menus (Data / View / AI) */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onAddRecords}
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
        >
          Add<span className="hidden sm:inline">{" Records"}</span>
        </Button>

        <div className="hidden sm:block h-6 w-px bg-slate-200 mx-1" />

        {/* Data menu — import / export */}
        {hasDataMenu && (
          <Dropdown
            align="left"
            trigger={(open, toggle) => (
              <Button
                onClick={toggle}
                variant="secondary"
                title="Data"
                icon={<Database className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Data</span>
                <ChevronDown className={cn(chevronCls, open && "rotate-180")} />
              </Button>
            )}
          >
            {(close) => (
              <>
                {onShowImportJsonDialog && (
                  <MenuItem
                    icon={<Upload className="w-4 h-4" />}
                    label="Import JSON"
                    onClick={() => {
                      close();
                      onShowImportJsonDialog();
                    }}
                  />
                )}
                {onShowExport && (
                  <MenuItem
                    icon={<FileSpreadsheet className="w-4 h-4" />}
                    label="Export to Excel"
                    onClick={() => {
                      close();
                      onShowExport();
                    }}
                  />
                )}
              </>
            )}
          </Dropdown>
        )}

        {/* View menu — columns / filters */}
        <Dropdown
          align="left"
          trigger={(open, toggle) => (
            <Button
              onClick={toggle}
              variant={showColumnSelector ? "primary" : "secondary"}
              title="View"
              icon={<Eye className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">View</span>
              <FilterBadge count={activeFilterCount} active={hasActiveFilters} />
              <ChevronDown className={cn(chevronCls, open && "rotate-180")} />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Columns className="w-4 h-4" />}
                label="Columns"
                onClick={() => {
                  close();
                  onToggleColumnSelector();
                }}
              />
              {onShowFilters && (
                <MenuItem
                  icon={<Filter className="w-4 h-4" />}
                  label="Filters"
                  hint={activeFilterCount > 0 ? String(activeFilterCount) : undefined}
                  onClick={() => {
                    close();
                    onShowFilters();
                  }}
                />
              )}
            </>
          )}
        </Dropdown>

        {/* AI menu — settings / generate / configure column */}
        <Dropdown
          align="left"
          trigger={(open, toggle) => (
            <Button
              onClick={toggle}
              variant="secondary"
              title="AI"
              className="text-purple-700 bg-purple-50 hover:bg-purple-100"
              icon={<Sparkles className="w-4 h-4 text-purple-600" />}
            >
              AI
              <ChevronDown className={cn(chevronCls, open && "rotate-180")} />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Settings className="w-4 h-4" />}
                label="AI Settings"
                onClick={() => {
                  close();
                  onShowAISettings();
                }}
              />
              <MenuItem
                icon={<Wand2 className="w-4 h-4 text-purple-500" />}
                label={
                  selectedRowsCount > 0
                    ? `Generate for selected (${selectedRowsCount})`
                    : "Generate for selected"
                }
                disabled={selectedRowsCount === 0}
                onClick={() => {
                  close();
                  onShowAIBulkDialog();
                }}
              />
              {canConfigureAI && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Configure column
                  </div>
                  {aiConfigurableColumns.map((col) => (
                    <MenuItem
                      key={col.key}
                      icon={<Wand2 className="w-4 h-4 text-purple-400" />}
                      label={col.name}
                      hint={col.type}
                      onClick={() => {
                        close();
                        onConfigureAIColumn?.(col.key);
                      }}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </Dropdown>
      </div>

      {/* RIGHT CLUSTER — view mode + pending-change actions */}
      <div className="flex items-center gap-2">
        {mode && onModeChange && (
          <ModeSwitcher mode={mode} onChange={onModeChange} hideBulk={hideBulk} />
        )}
        {hasChanges && (
          <Button
            onClick={onDiscardChanges}
            variant="secondary"
            title="Discard changes"
            icon={<Trash2 className="w-4 h-4" />}
          >
            <span className="hidden lg:inline">Discard Changes</span>
          </Button>
        )}
        {hasChanges && (
          <Button
            onClick={onSaveChanges}
            disabled={isSaving}
            loading={isSaving}
            variant="primary"
            title="Save changes"
            icon={<Save className="w-4 h-4" />}
          >
            <span className="hidden lg:inline">Save Changes</span>
          </Button>
        )}
      </div>
    </div>
  );
}
