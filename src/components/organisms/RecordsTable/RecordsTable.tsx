import { useState, useCallback, useEffect, useRef } from "react";
import { Loader2, AlertCircle, Table } from "lucide-react";
import { usePocketBase } from "../../../context/usePocketBase";
import type { TrackedRecord } from "../../../types/pocketbase.types";
import type { Column } from "../../../types/records.types";
import { RecordsTableActions } from "./RecordsTableActions";
import { SaveNotification } from "../../molecules/SaveNotification";
import { AIStatusIndicator } from "../../molecules/AIStatusIndicator";
import { AISettingsDialog } from "../../AISettingsDialog";
import { AIColumnConfigDialog } from "../../AIColumnConfigDialog";
import { AddRecordsDialog } from "../../records-table/AddRecordsDialog";
import { AIBulkDialog } from "../../records-table/AIBulkDialog";
import { ColumnDrawer } from "../../records-table/ColumnDrawer";
import { ImportJsonDialog } from "../../records-table/ImportJsonDialog";
import { ImportResultNotification } from "../../records-table/ImportResultNotification";
import { MasterDetailView } from "../../records-table/MasterDetailView";
import { DetailPanel } from "../../records-table/DetailPanel";
import { BulkTableView } from "../../records-table/BulkTableView";
import { BulkActionBar } from "../../records-table/BulkActionBar";
import type { TableMode } from "../../records-table/ModeSwitcher";
import { useTableSelection } from "../../records-table/hooks/useTableSelection";
import { useColumnVisibility } from "../../records-table/hooks/useColumnVisibility";
import { useAIGeneration } from "../../records-table/hooks/useAIGeneration";
import { useTableFilters } from "../../records-table/hooks/useTableFilters";
import { useTableMode } from "../../records-table/hooks/useTableMode";
import { useViewport } from "../../../hooks/useViewport";
import { getDisplayColumns } from "../../../utils/formatters";
import { FilterDrawer } from "../../records-table/FilterDrawer";
import { generateAIContent, generateAIImage } from "../../../context/useAI";

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
    refreshRecords,
    client,
    getAIConfig,
    aiApiKey,
  } = usePocketBase();

  const [relationOptions, setRelationOptions] = useState<
    Record<string, { id: string; [key: string]: unknown }[]>
  >({});
  // Track loading collections using a ref for immediate atomic access
  const loadingCollectionsRef = useRef<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showAIColumnConfig, setShowAIColumnConfig] = useState(false);
  const [configuringColumn, setConfiguringColumn] = useState<string | null>(null);
  const [showImportJsonDialog, setShowImportJsonDialog] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ index: number; record: unknown; error: string }>;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { mode, setMode } = useTableMode();
  const viewport = useViewport();

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
    aiGenerating,
    showAIBulkDialog,
    setShowAIBulkDialog,
    handleGenerateAI,
  } = useAIGeneration(trackedRecords, selectedCollection, updateCell);

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

  const loadRelationOptions = useCallback(async (collectionId: string) => {
    console.log("[loadRelationOptions] called with collectionId:", collectionId);
    if (relationOptions[collectionId]) {
      console.log("[loadRelationOptions] already loaded, skipping");
      return;
    }

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

  const handleAddRows = useCallback(() => {
    addNewRows(1);
    setShowAddDialog(false);
  }, [addNewRows]);

  const handleSaveChanges = useCallback(async () => {
    await saveAllChanges();
  }, [saveAllChanges]);

  const handleDiscardChanges = useCallback(() => {
    discardChanges();
  }, [discardChanges]);

  const handleSelectAllBool = useCallback(
    (checked: boolean) => {
      handleSelectAll({ target: { checked } } as React.ChangeEvent<HTMLInputElement>);
    },
    [handleSelectAll],
  );

  // Auto-load relation options when the visible columns include relation fields
  useEffect(() => {
    const cols = displayColumns.filter(
      (c) => c.type === "relation" && c.collectionId,
    );
    cols.forEach((col) => {
      if (col.collectionId) void loadRelationOptions(col.collectionId);
    });
  }, [displayColumns, loadRelationOptions]);

  // Reset selected index when the collection changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [selectedCollection?.id]);

  // Clamp the selected index to the available records
  const safeIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredRecords.length - 1),
  );

  useEffect(() => {
    if (saveResult) {
      const timer = setTimeout(() => {
        clearSaveResult();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveResult, clearSaveResult]);

  const handleShowAIBulkDialog = useCallback(() => {
    if (selectedRows.length === 0) return;
    setShowAIBulkDialog(true);
  }, [selectedRows]);

  const handleShowImportJsonDialog = useCallback(() => {
    setShowImportJsonDialog(true);
    setImportResult(null);
  }, []);

  const handleImportJson = useCallback(async (jsonData: unknown[]) => {
    if (!client || !selectedCollection) {
      throw new Error("Not connected to PocketBase or no collection selected");
    }

    const errors: Array<{ index: number; record: unknown; error: string }> = [];
    let successCount = 0;
    let failedCount = 0;

    console.log(`[Import] Starting import of ${jsonData.length} records into collection "${selectedCollection.name}"`);

    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i];
      
      try {
        await client.collection(selectedCollection.name).create(record as Record<string, unknown>);
        successCount++;
        console.log(`[Import] Record #${i + 1} created successfully`);
      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Import] Record #${i + 1} failed:`, errorMessage);
        errors.push({
          index: i + 1,
          record,
          error: errorMessage,
        });
      }

      if ((i + 1) % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const result = {
      success: successCount,
      failed: failedCount,
      errors,
    };

    console.log(`[Import] Import completed: ${successCount} successful, ${failedCount} failed`);

    setImportResult(result);

    console.log("[Import] Refreshing records...");
    await refreshRecords();
    console.log("[Import] Refresh completed");

    return result;
  }, [client, selectedCollection, refreshRecords]);

  const handleBulkGenerateAI = useCallback(async (columnNames?: string[]) => {
    if (!columnNames || columnNames.length === 0) {
      if (selectedRows.length === 0) return;
      setShowAIBulkDialog(true);
      return;
    }

    if (!selectedCollection || !aiApiKey) return;

    const configs = columnNames.map((colName) => ({
      name: colName,
      config: getAIConfig(selectedCollection.name, colName),
    })).filter((c) => c.config);

    if (configs.length === 0) return;

    const selectedRecords = trackedRecords.filter((r) =>
      selectedRows.includes(r.id)
    );
    if (selectedRecords.length === 0) return;

    setShowAIBulkDialog(false);

    for (const { name: columnName, config: columnConfig } of configs) {
      if (!columnConfig) continue;
      
      for (const record of selectedRecords) {
        const config = columnConfig;
        let prompt = config.defaultPrompt;
        let variableColumns = config.defaultVariableColumns;

        if (config.conditionalRules && config.conditionalRules.length > 0) {
          for (const rule of config.conditionalRules) {
            const fieldValue = record.data[rule.column];
            let matches = false;

            switch (rule.operator) {
              case "eq":
                matches = fieldValue === rule.value;
                break;
              case "neq":
                matches = fieldValue !== rule.value;
                break;
              case "gt":
                matches = typeof fieldValue === "number" &&
                         typeof rule.value === "number" &&
                         fieldValue > rule.value;
                break;
              case "gte":
                matches = typeof fieldValue === "number" &&
                         typeof rule.value === "number" &&
                         fieldValue >= rule.value;
                break;
              case "lt":
                matches = typeof fieldValue === "number" &&
                         typeof rule.value === "number" &&
                         fieldValue < rule.value;
                break;
              case "lte":
                matches = typeof fieldValue === "number" &&
                         typeof rule.value === "number" &&
                         fieldValue <= rule.value;
                break;
              case "contains":
                matches = typeof fieldValue === "string" &&
                         typeof rule.value === "string" &&
                         fieldValue.includes(rule.value);
                break;
              case "startsWith":
                matches = typeof fieldValue === "string" &&
                         typeof rule.value === "string" &&
                         fieldValue.startsWith(rule.value);
                break;
            }

            if (matches && rule.prompt) {
              prompt = rule.prompt;
              variableColumns = rule.variableColumns || variableColumns;
            }
          }
        }

        if (!prompt) continue;

        try {
          if (config.generateImage) {
            const file = await generateAIImage(
              aiApiKey,
              prompt,
              variableColumns,
              record.data,
              config.model || "gemini-3.1-flash-image-preview",
            );
            updateCell(record.id, columnName, file);
          } else {
            const content = await generateAIContent(
              aiApiKey,
              prompt,
              variableColumns,
              record.data,
              config.formatInstructions,
              config.model || "gemini-2.5-flash",
            );
            updateCell(record.id, columnName, content);
          }
        } catch (error) {
          console.error(`AI generation failed for record ${record.id}, column ${columnName}:`, error);
        }
      }
    }
  }, [aiApiKey, selectedCollection, getAIConfig, trackedRecords, selectedRows, setShowAIBulkDialog, updateCell]);

  const handleShowAIColumnConfig = useCallback((columnName: string) => {
    setConfiguringColumn(columnName);
    setShowAIColumnConfig(true);
  }, []);

   return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-600">Loading records...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <span className="ml-3 text-red-600">{error}</span>
        </div>
      ) : trackedRecords.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          <RecordsTableActions
            hasChanges={hasChanges}
            isSaving={isSaving}
            selectedRowsCount={selectedRows.length}
            showColumnSelector={showColumnSelector}
            onAddRecords={handleAddRows}
            onDiscardChanges={handleDiscardChanges}
            onSaveChanges={handleSaveChanges}
            onToggleColumnSelector={() => setShowColumnSelector(!showColumnSelector)}
            onShowAISettings={() => setShowAISettings(true)}
            onShowAIBulkDialog={handleShowAIBulkDialog}
            onShowImportJsonDialog={handleShowImportJsonDialog}
            onShowFilters={() => setShowFilterDrawer(true)}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
            mode={mode}
            onModeChange={setMode}
            hideBulk={viewport.isMobile}
            displayColumns={displayColumns}
            onConfigureAIColumn={handleShowAIColumnConfig}
          />

          {saveResult && (
            <SaveNotification
              success={saveResult.success}
              failed={saveResult.failed}
              onDismiss={clearSaveResult}
            />
          )}

          <AIStatusIndicator generatingCells={aiGenerating} />

          <RecordsBody
            mode={viewport.isMobile && mode === "bulk" ? "browse" : mode}
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
            onShowAIBulkDialog={handleShowAIBulkDialog}
            bulkGenerating={Object.keys(aiGenerating).length > 0}
            onGenerateAI={handleGenerateAI}
          />
        </div>
      )}

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
        onClose={() => {
          setShowAIColumnConfig(false);
          setConfiguringColumn(null);
        }}
        columnName={configuringColumn || ""}
        collectionSchema={selectedCollection?.schema || selectedCollection?.fields || []}
      />

      <AIBulkDialog
        isOpen={showAIBulkDialog}
        onClose={() => setShowAIBulkDialog(false)}
        selectedRowsCount={selectedRows.length}
        displayColumns={displayColumns}
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

      <ImportJsonDialog
        isOpen={showImportJsonDialog}
        onClose={() => setShowImportJsonDialog(false)}
        collectionName={selectedCollection?.name || ""}
        collectionSchema={selectedCollection?.schema || []}
        onImport={handleImportJson}
      />

      {importResult && (
        <ImportResultNotification
          success={importResult.success}
          failed={importResult.failed}
          onViewErrors={importResult.failed > 0 ? () => setShowImportJsonDialog(true) : undefined}
          onDismiss={() => setImportResult(null)}
        />
      )}
    </>
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
  onGenerateAI: (recordId: string, columnName: string) => void;
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
  onGenerateAI,
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
          relationOptions={relationOptions}
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
            record={selectedRecord}
            columns={displayColumns}
            relationOptions={relationOptions}
            onUpdateCell={updateCell}
            onPrev={() => onSelectIndex(Math.max(0, selectedIndex - 1))}
            onNext={() =>
              onSelectIndex(
                Math.min(filteredRecords.length - 1, selectedIndex + 1),
              )
            }
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < filteredRecords.length - 1}
            position={selectedIndex}
            total={filteredRecords.length}
            initialEditMode={mode === "individual"}
            className="max-h-[calc(100vh-220px)] overflow-y-auto"
            onGenerateAI={onGenerateAI}
            aiGenerating={aiGenerating}
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
