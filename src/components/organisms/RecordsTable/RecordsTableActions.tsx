import { Plus, Trash2, Save, Columns, Settings, Wand2, Filter, Upload, LayoutList } from "lucide-react";
import { Button } from "../../atoms/Button";

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
  onShowRowNavigator?: () => void;
  onShowFilters?: () => void;
  activeFilterCount?: number;
  hasActiveFilters?: boolean;
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
  onShowRowNavigator,
  onShowFilters,
  activeFilterCount = 0,
  hasActiveFilters = false,
}: TableActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
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
        {onShowRowNavigator && (
          <Button
            onClick={onShowRowNavigator}
            variant="secondary"
            icon={<LayoutList className="w-4 h-4" />}
          >
            Row Navigator
          </Button>
        )}
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
