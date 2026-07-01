import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, AlertCircle, Table, CheckCircle, XCircle } from "lucide-react";
import { usePocketBase } from "../../context/usePocketBase";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import { AISettingsDialog } from "../AISettingsDialog";
import { AIColumnConfigDialog } from "../AIColumnConfigDialog";
import { getDisplayColumns } from "./utils";
import type { Column } from "./types";
import { useTableSelection } from "./hooks/useTableSelection";
import { useColumnVisibility } from "./hooks/useColumnVisibility";
import { useAIGeneration } from "./hooks/useAIGeneration";
import { useTableFilters } from "./hooks/useTableFilters";
import { ColumnDrawer } from "./ColumnDrawer";
import { AddRecordsDialog } from "./AddRecordsDialog";
import { AIBulkDialog } from "./AIBulkDialog";
import { TableActions } from "./TableActions";
import { FilterDrawer } from "./FilterDrawer";
import { ModeSwitcher, type TableMode } from "./ModeSwitcher";
import { MasterDetailView } from "./MasterDetailView";
import { BulkTableView } from "./BulkTableView";
import { DetailPanel } from "./DetailPanel";
import { BulkActionBar } from "./BulkActionBar";
import { useViewport } from "../../hooks/useViewport";

const MODE_STORAGE_KEY = "records-table-mode";

function loadStoredMode(): TableMode {
  if (typeof window === "undefined") return "browse";
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === "browse" || stored === "individual" || stored === "bulk") {
    return stored;
  }
  return "browse";
}

export function RecordsTable() {
  const {
    selectedCollection,
    trackedRecords,
    isLoading,
    error,
    updateCell,
    addNewRows,
    discardChanges,
    hasChanges,
    isSaving,
    saveResult,
    saveAllChanges,
    clearSaveResult,
    client,
  } = usePocketBase();

  const [relationOptions, setRelationOptions] = useState<
    Record<string, { id: string; [key: string]: unknown }[]>
  >({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAIColumnConfig, setShowAIColumnConfig] = useState(false);
  const [configuringColumn, setConfiguringColumn] = useState<string | null>(null);
  void setConfiguringColumn;
  const [rowsToAdd, setRowsToAdd] = useState(1);
  const [mode, setMode] = useState<TableMode>(loadStoredMode);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const viewport = useViewport();
  const loadingCollectionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  const {
    visibleColumnKeys,
    showColumnSelector,
    setShowColumnSelector,
    allColumns,
    displayColumns,
    toggleColumnVisibility,
    selectAllColumns,
    clearAllColumns,
  } = useColumnVisibility(selectedCollection, getDisplayColumns);

  const {
    filters,
    filteredRecords,
    setGlobalSearch,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount,
    setShowFilterDrawer,
  } = useTableFilters({ records: trackedRecords, columns: displayColumns });

  const { selectedRows, handleSelectAll, handleRowSelect } = useTableSelection(
    filteredRecords,
    selectedCollection,
  );

  const {
    aiGenerating,
    bulkGeneratingColumn,
    showAIBulkDialog,
    setShowAIBulkDialog,
  } = useAIGeneration(trackedRecords, selectedCollection, updateCell);

  const loadRelationOptions = useCallback(
    async (collectionId: string) => {
      if (relationOptions[collectionId]) return;
      if (loadingCollectionsRef.current.has(collectionId)) return;
      loadingCollectionsRef.current.add(collectionId);

      try {
        if (!client) return;
        const records = await client.collection(collectionId).getFullList();
        setRelationOptions((prev) => ({
          ...prev,
          [collectionId]: records,
        }));
      } catch (err) {
        console.error("Failed to load relation options:", err);
      } finally {
        loadingCollectionsRef.current.delete(collectionId);
      }
    },
    [relationOptions, client],
  );

  useEffect(() => {
    const cols = displayColumns.filter((c) => c.type === "relation" && c.collectionId);
    cols.forEach((col) => {
      if (col.collectionId) void loadRelationOptions(col.collectionId);
    });
  }, [displayColumns, loadRelationOptions]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, filteredRecords.length - 1));

  useEffect(() => {
    setSelectedIndex(0);
  }, [selectedCollection?.id]);

  const handleSelectAllBool = useCallback(
    (checked: boolean) => {
      handleSelectAll({ target: { checked } } as React.ChangeEvent<HTMLInputElement>);
    },
    [handleSelectAll],
  );

  const handleBulkGenerateAI = useCallback(
    async (columnNames?: string[]) => {
      if (!selectedCollection) return;
      if (!columnNames || columnNames.length === 0) {
        const selectedRecords = trackedRecords.filter((r) =>
          selectedRows.includes(r.id),
        );
        if (selectedRecords.length === 0) return;
        setShowAIBulkDialog(true);
        return;
      }
    },
    [trackedRecords, selectedRows, selectedCollection, setShowAIBulkDialog],
  );

  const handleAddRows = useCallback(() => {
    addNewRows(rowsToAdd);
    setShowAddDialog(false);
    setRowsToAdd(1);
  }, [rowsToAdd, addNewRows]);

  const handleSaveChanges = useCallback(async () => {
    await saveAllChanges();
  }, [saveAllChanges]);

  const handleDiscardChanges = useCallback(() => {
    discardChanges();
  }, [discardChanges]);

  useEffect(() => {
    if (saveResult) {
      const timer = setTimeout(() => {
        clearSaveResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveResult, clearSaveResult]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-3 text-red-600">{error}</span>
      </div>
    );
  }

  if (trackedRecords.length === 0) {
    return (
      <div className="text-center py-12">
        <Table className="w-12 h-12 mx-auto text-slate-400 mb-4" />
        <p className="text-slate-600 mb-4">No records in this collection</p>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Records
        </button>
      </div>
    );
  }

  const hideBulk = viewport.isMobile;
  const visibleMode: TableMode = hideBulk && mode === "bulk" ? "browse" : mode;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TableActions
          hasChanges={hasChanges}
          isSaving={isSaving}
          selectedRowsCount={selectedRows.length}
          showColumnSelector={showColumnSelector}
          setShowColumnSelector={setShowColumnSelector}
          setShowAISettings={setShowAISettings}
          onAddRecords={() => setShowAddDialog(true)}
          onDiscardChanges={handleDiscardChanges}
          onSaveChanges={handleSaveChanges}
          onShowAIBulkDialog={() => setShowAIBulkDialog(true)}
          onShowFilters={() => setShowFilterDrawer(true)}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
        />
        <ModeSwitcher mode={mode} onChange={setMode} hideBulk={hideBulk} />
      </div>

      {saveResult && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Changes saved successfully
            </p>
            <p className="text-xs text-green-600">
              {saveResult.success} records updated
              {saveResult.failed > 0 && `, ${saveResult.failed} failed`}
            </p>
          </div>
          <button
            onClick={clearSaveResult}
            className="p-1 hover:bg-green-100 rounded transition-colors"
          >
            <XCircle className="w-5 h-5 text-green-600" />
          </button>
        </div>
      )}

      {Object.keys(aiGenerating).length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg animate-pulse">
          <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
          <div className="flex-1">
            <p className="text-sm font-medium text-purple-800">
              Generating AI content...
            </p>
            <p className="text-xs text-purple-600">
              {Object.keys(aiGenerating).length} cell
              {Object.keys(aiGenerating).length > 1 ? "s" : ""} being generated
            </p>
          </div>
        </div>
      )}

      <RecordsBody
        mode={visibleMode}
        filteredRecords={filteredRecords}
        displayColumns={displayColumns}
        selectedRows={selectedRows}
        onToggleRowSelect={handleRowSelect}
        onSelectAll={handleSelectAllBool}
        selectedIndex={safeIndex}
        onSelectIndex={setSelectedIndex}
        updateCell={updateCell}
        relationOptions={relationOptions}
        aiGenerating={aiGenerating}
        onClearSelection={() => handleSelectAllBool(false)}
        onShowAIBulkDialog={() => setShowAIBulkDialog(true)}
        bulkGenerating={Object.keys(aiGenerating).length > 0}
      />

      <AddRecordsDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddRows}
      />

      <AISettingsDialog isOpen={showAISettings} onClose={() => setShowAISettings(false)} />

      <AIColumnConfigDialog
        isOpen={showAIColumnConfig}
        onClose={() => setShowAIColumnConfig(false)}
        columnName={configuringColumn || ""}
        collectionSchema={selectedCollection?.schema || selectedCollection?.fields || []}
      />

      <AIBulkDialog
        isOpen={showAIBulkDialog}
        onClose={() => setShowAIBulkDialog(false)}
        selectedRowsCount={selectedRows.length}
        displayColumns={displayColumns}
        bulkGeneratingColumn={bulkGeneratingColumn}
        onGenerate={handleBulkGenerateAI}
      />

      <ColumnDrawer
        isOpen={showColumnSelector}
        onClose={() => setShowColumnSelector(false)}
        visibleColumnKeys={visibleColumnKeys}
        allColumns={allColumns}
        toggleColumnVisibility={toggleColumnVisibility}
        selectAllColumns={selectAllColumns}
        clearAllColumns={clearAllColumns}
      />

      <FilterDrawer
        isOpen={filters.showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        filters={filters}
        onGlobalSearchChange={setGlobalSearch}
        onColumnFilterChange={setColumnFilter}
        onClearAll={clearAllFilters}
        displayColumns={displayColumns}
        relationOptions={relationOptions}
      />
    </div>
  );
}

interface RecordsBodyProps {
  mode: TableMode;
  filteredRecords: TrackedRecord[];
  displayColumns: Column[];
  selectedRows: string[];
  onToggleRowSelect: (rowId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  updateCell: (rowId: string, field: string, value: unknown) => void;
  relationOptions: Record<string, { id: string; [key: string]: unknown }[]>;
  aiGenerating: Record<string, boolean>;
  onClearSelection: () => void;
  onShowAIBulkDialog: () => void;
  bulkGenerating: boolean;
}

function RecordsBody({
  mode,
  filteredRecords,
  displayColumns,
  selectedRows,
  onToggleRowSelect,
  onSelectAll,
  selectedIndex,
  onSelectIndex,
  updateCell,
  relationOptions,
  aiGenerating,
  onClearSelection,
  onShowAIBulkDialog,
  bulkGenerating,
}: RecordsBodyProps) {
  const selectedRecord = filteredRecords[selectedIndex] || null;

  if (mode === "bulk") {
    return (
      <div className="space-y-3">
        <BulkTableView
          records={filteredRecords}
          columns={displayColumns}
          selectedRows={selectedRows}
          onToggleRowSelect={onToggleRowSelect}
          onSelectAll={onSelectAll}
          onUpdateCell={updateCell}
          aiGenerating={aiGenerating}
        />
        <BulkActionBar
          selectedCount={selectedRows.length}
          totalCount={filteredRecords.length}
          onClearSelection={onClearSelection}
          onGenerateAI={onShowAIBulkDialog}
          isGenerating={bulkGenerating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <MasterDetailView
        records={filteredRecords}
        columns={displayColumns}
        selectedIndex={selectedIndex}
        onSelectIndex={onSelectIndex}
        selectedRows={selectedRows}
        onToggleRowSelect={onToggleRowSelect}
        onSelectAll={onSelectAll}
        renderDetail={() => (
          <DetailPanel
            key={selectedRecord?.id ?? "empty"}
            record={selectedRecord}
            columns={displayColumns}
            relationOptions={relationOptions}
            onUpdateCell={updateCell}
            onPrev={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
            onNext={() =>
              onSelectIndex(Math.min(filteredRecords.length - 1, selectedIndex + 1))
            }
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < filteredRecords.length - 1}
            position={selectedIndex}
            total={filteredRecords.length}
            initialEditMode={mode === "individual"}
            className="max-h-[calc(100vh-220px)] overflow-y-auto"
          />
        )}
      />
      <BulkActionBar
        selectedCount={selectedRows.length}
        totalCount={filteredRecords.length}
        onClearSelection={onClearSelection}
        onGenerateAI={onShowAIBulkDialog}
        isGenerating={bulkGenerating}
      />
    </div>
  );
}
