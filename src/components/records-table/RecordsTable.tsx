import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, type ColumnDef } from "@tanstack/react-table";
import { Loader2, AlertCircle, Table, CheckCircle, XCircle } from "lucide-react";
import { usePocketBase } from "../../context/usePocketBase";
import type { TrackedRecord } from "../../context/PocketBaseContext";
import { AISettingsDialog } from "../AISettingsDialog";
import { AIColumnConfigDialog } from "../AIColumnConfigDialog";
import { getDisplayColumns, getColumnSize } from "./utils";
import type { Column } from "./types";
import { useTableSelection } from "./hooks/useTableSelection";
import { useColumnVisibility } from "./hooks/useColumnVisibility";
import { useAIGeneration } from "./hooks/useAIGeneration";
import { useTableFilters } from "./hooks/useTableFilters";
import { CellEditor } from "./CellEditor";
import { ColumnDrawer } from "./ColumnDrawer";
import { PreviewPanel } from "./PreviewPanel";
import { AddRecordsDialog } from "./AddRecordsDialog";
import { AIBulkDialog } from "./AIBulkDialog";
import { TableActions } from "./TableActions";
import { FilterDrawer } from "./FilterDrawer";
import { TableBody, TableHeader } from "./TableBody";

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
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  // Track loading collections using a ref for immediate atomic access
  const loadingCollectionsRef = useRef<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({});
  const [selectedCell, setSelectedCell] = useState<{
    recordId: string;
    field: string;
    value: unknown;
    column: Column;
  } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAIColumnConfig, setShowAIColumnConfig] = useState(false);
  const [configuringColumn, setConfiguringColumn] = useState<string | null>(null);
  const [rowsToAdd, setRowsToAdd] = useState(1);

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
    handleGenerateAI,
  } = useAIGeneration(trackedRecords, selectedCollection, updateCell);

  console.log('[RecordsTable] Filter props:', { hasActiveFilters, activeFilterCount, displayColumnsLength: displayColumns.length });

  const handleBulkGenerateAI = useCallback(
    async (columnNames?: string[]) => {
      if (!selectedCollection) return;
      if (!columnNames || columnNames.length === 0) {
        const selectedRecords = trackedRecords.filter((r) =>
          selectedRows.includes(r.id)
        );
        if (selectedRecords.length === 0) return;
        setShowAIBulkDialog(true);
        return;
      }
    },
    [trackedRecords, selectedRows, selectedCollection, setShowAIBulkDialog],
  );

  const loadRelationOptions = useCallback(async (collectionId: string) => {
    if (relationOptions[collectionId]) return;

    // Check ref atomically - if already loading, return immediately
    if (loadingCollectionsRef.current.has(collectionId)) {
      console.log(`[loadRelationOptions] Collection ${collectionId} already loading, skipping`);
      return;
    }

    // Add to ref atomically
    loadingCollectionsRef.current.add(collectionId);

    try {
      if (!client) return;
      console.log(`[loadRelationOptions] Loading options for collection: ${collectionId}`);
      const records = await client.collection(collectionId).getFullList();
      console.log(`[loadRelationOptions] Successfully loaded ${records.length} options for ${collectionId}`);
      setRelationOptions((prev) => ({
        ...prev,
        [collectionId]: records,
      }));
    } catch (err) {
      console.error("Failed to load relation options:", err);
    } finally {
      loadingCollectionsRef.current.delete(collectionId);
    }
  }, [relationOptions, client]);

  const columnDefinitions = useMemo<ColumnDef<TrackedRecord>[]>(
    () => [
      {
        id: "select",
        accessorKey: "__select__",
        size: 24,
        minSize: 24,
        maxSize: 24,
        header: () => {
          const allSelected =
            selectedRows.length > 0 &&
            selectedRows.length === filteredRecords.length;
          return (
            <div className="flex items-center justify-center w-full h-full">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3 h-3 flex-shrink-0"
                autoComplete="off"
                data-form-type="other"
                aria-label="Select all rows"
              />
            </div>
          );
        },
        cell: ({ row }: any) => {
          const isChecked = selectedRows.includes(row.original.id);
          return (
            <div className="flex items-center justify-center w-full h-full">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => handleRowSelect(row.original.id, e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3 h-3 flex-shrink-0"
                autoComplete="off"
                data-form-type="other"
                aria-label={`Select row ${row.original.id}`}
              />
            </div>
          );
        },
        meta: {
          cellClassName: "px-1 py-2",
          headerClassName: "px-1 py-3",
        },
      },
      ...displayColumns.map((col) => ({
        accessorKey: col.key,
        header: col.name,
        size: getColumnSize(col),
        minSize: 50,
        maxSize: 1000,
        enableResizing: true,
        cell: ({ row }: any) => {
          const value = row.original.data[col.key];
          const cellKey = `${row.original.id}-${col.key}`;
          const isExpanded = expandedCells[cellKey];

          return (
            <CellEditor
              record={row.original}
              column={col}
              value={value}
              isExpanded={isExpanded}
              onToggleExpand={() => {
                setExpandedCells((prev) => ({
                  ...prev,
                  [cellKey]: !isExpanded,
                }));
              }}
              onUpdate={(newValue) => {
                updateCell(row.original.id, col.key, newValue);
              }}
              onCellFocus={(recordId, field, value, column) => {
                setSelectedCell({
                  recordId,
                  field,
                  value,
                  column,
                });
              }}
              onLoadRelationOptions={loadRelationOptions}
              relationOptions={relationOptions}
              onGenerateAI={handleGenerateAI}
              aiGenerating={aiGenerating}
              client={client}
            />
          );
        },
      })),
    ],
    [displayColumns, updateCell, getColumnSize, loadRelationOptions, relationOptions, aiGenerating, handleGenerateAI, selectedRows, handleSelectAll, handleRowSelect, expandedCells, previewMode, filteredRecords.length],
  );

  const table = useReactTable({
    data: filteredRecords,
    columns: columnDefinitions,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

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
    setExpandedCells({});
    setPreviewMode({});
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

  return (
    <div className="space-y-4">
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

      <div className="flex gap-4">
        <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <TableHeader
                table={table}
                setConfiguringColumn={setConfiguringColumn}
                onShowAIColumnConfig={() => setShowAIColumnConfig(true)}
              />
              <TableBody table={table} trackedRecords={trackedRecords} />
            </table>
          </div>
        </div>

        <PreviewPanel
          selectedCell={selectedCell}
          onClose={() => setSelectedCell(null)}
        />
      </div>

      <AddRecordsDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddRows}
      />

      <AISettingsDialog
        isOpen={showAISettings}
        onClose={() => setShowAISettings(false)}
      />

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
