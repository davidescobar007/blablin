import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useReactTable, getCoreRowModel, type ColumnDef } from "@tanstack/react-table";
import { Loader2, AlertCircle, Table, Wand2 } from "lucide-react";
import { usePocketBase } from "../../../context/usePocketBase";
import type { TrackedRecord, AIColumnConfig } from "../../../types/pocketbase.types";
import type { Column } from "../../../types/records.types";
import { RecordsTableActions } from "./RecordsTableActions";
import { RecordsTableBody } from "./RecordsTableBody";
import { SaveNotification } from "../../molecules/SaveNotification";
import { AIStatusIndicator } from "../../molecules/AIStatusIndicator";
import { AISettingsDialog } from "../../AISettingsDialog";
import { AIColumnConfigDialog } from "../../organisms/AIColumnConfig";
import { AddRecordsDialog } from "../../records-table/AddRecordsDialog";
import { AIBulkDialog } from "../../records-table/AIBulkDialog";
import { ColumnDrawer } from "../../records-table/ColumnDrawer";
import { PreviewPanel } from "../../records-table/PreviewPanel";
import { ImportJsonDialog } from "../../records-table/ImportJsonDialog";
import { ImportResultNotification } from "../../records-table/ImportResultNotification";
import { RowNavigatorDrawer } from "../../records-table/RowNavigatorDrawer";
import { useTableSelection } from "../../records-table/hooks/useTableSelection";
import { useColumnVisibility } from "../../records-table/hooks/useColumnVisibility";
import { useAIGeneration } from "../../records-table/hooks/useAIGeneration";
import { useTableFilters } from "../../records-table/hooks/useTableFilters";
import { getDisplayColumns } from "../../../utils/formatters";
import { flexRender } from "@tanstack/react-table";
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
    setAIConfig,
    aiApiKey,
  } = usePocketBase();

  const [relationOptions, setRelationOptions] = useState<
    Record<string, { id: string; [key: string]: unknown }[]>
  >({});
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  // Track loading collections using a ref for immediate atomic access
  const loadingCollectionsRef = useRef<Set<string>>(new Set());
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
  const [aiConfig, setAiConfig] = useState<AIColumnConfig | null>(null);
  const [showImportJsonDialog, setShowImportJsonDialog] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: Array<{ index: number; record: unknown; error: string }>;
  } | null>(null);
  const [showRowNavigator, setShowRowNavigator] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

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
        cell: ({ row }: { row: { original: { id: string } } }) => {
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
      ...displayColumns.map((column) => ({
        id: column.key,
        accessorKey: `data.${column.key}`,
        header: column.name,
        size: 150,
        meta: {
          cellClassName: "px-4 py-2",
          headerClassName: "px-4 py-3",
        },
      })),
    ],
    [selectedRows, trackedRecords.length, handleSelectAll, handleRowSelect, displayColumns],
  );

  const table = useReactTable({
    data: filteredRecords,
    columns: columnDefinitions,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  const handleAddRows = useCallback(() => {
    addNewRows(1);
    setShowAddDialog(false);
  }, [addNewRows]);

  const handleSaveChanges = useCallback(async () => {
    await saveAllChanges();
  }, [saveAllChanges]);

  const handleDiscardChanges = useCallback(() => {
    discardChanges();
    setExpandedCells({});
  }, [discardChanges]);

  const handleCellFocus = useCallback((recordId: string, field: string, value: unknown, column: Column) => {
    setSelectedCell({ recordId, field, value, column });
  }, []);

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

  const handleShowRowNavigator = useCallback(() => {
    setShowRowNavigator((prev) => !prev);
    setCurrentRowIndex(0);
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
    if (selectedCollection) {
      const config = getAIConfig(selectedCollection.name, columnName);
      setConfiguringColumn(columnName);
      setAiConfig(config);
      setShowAIColumnConfig(true);
    }
  }, [selectedCollection, getAIConfig, setShowAIColumnConfig]);

  const handleSaveAIConfig = useCallback((config: AIColumnConfig | null) => {
    if (selectedCollection && configuringColumn) {
      setAIConfig(selectedCollection.name, configuringColumn, config);
    }
  }, [selectedCollection, configuringColumn, setAIConfig]);

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
            onShowRowNavigator={handleShowRowNavigator}
            onShowFilters={() => setShowFilterDrawer(true)}
            activeFilterCount={activeFilterCount}
            hasActiveFilters={hasActiveFilters}
          />

          {saveResult && (
            <SaveNotification
              success={saveResult.success}
              failed={saveResult.failed}
              onDismiss={clearSaveResult}
            />
          )}

          <AIStatusIndicator generatingCells={aiGenerating} />

          <div className="flex gap-4">
            <div className="flex-1 border border-slate-200 rounded-lg overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    {table.getHeaderGroups().map((headerGroup: any) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header: any) => {
                          const headerClassName = header.column.columnDef.meta?.headerClassName || "px-4 py-3";
                          const isSelectColumn = header.column.id === "select";

                          return (
                            <th
                              key={header.id}
                              className={`${headerClassName} text-left text-xs font-semibold text-slate-500 uppercase tracking-wider relative`}
                              style={{ width: header.getSize() }}
                            >
                              {isSelectColumn ? (
                                <div className="flex items-center justify-center w-full h-full">
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 flex items-center gap-2">
                                    {header.isPlaceholder
                                      ? null
                                      : flexRender(
                                          header.column.columnDef.header,
                                          header.getContext(),
                                        )}
                                   {!header.isPlaceholder &&
                                     header.column.id !== "state" && (
                                       <button
                                         onClick={() => handleShowAIColumnConfig(header.column.id)}
                                         className="ml-1 p-1 rounded hover:bg-purple-100 text-slate-400 hover:text-purple-600 transition-colors"
                                         title="Configure AI for this column"
                                       >
                                         <Wand2 className="w-3 h-3" />
                                       </button>
                                     )}
                                  </div>
                                  {header.column.getCanResize() && (
                                    <div
                                      {...{
                                        onMouseDown: header.getResizeHandler(),
                                        onTouchStart: header.getResizeHandler(),
                                        className: `absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${
                                          header.column.getIsResizing()
                                            ? "bg-blue-500"
                                            : ""
                                        }`,
                                      }}
                                    >
                                      <div className="w-0.5 h-full bg-slate-300" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <RecordsTableBody
                    table={table}
                    displayColumns={displayColumns}
                    updateCell={updateCell}
                    client={client}
                    relationOptions={relationOptions}
                    loadRelationOptions={loadRelationOptions}
                    onCellFocus={handleCellFocus}
                    onGenerateAI={handleGenerateAI}
                    aiGenerating={aiGenerating}
                    expandedCells={expandedCells}
                    setExpandedCells={setExpandedCells}
                  />
                </table>
              </div>
            </div>

            <PreviewPanel
              selectedCell={selectedCell}
              onClose={() => setSelectedCell(null)}
            />
          </div>
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
        config={aiConfig}
        onSave={handleSaveAIConfig}
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

      <RowNavigatorDrawer
        isOpen={showRowNavigator}
        onClose={() => setShowRowNavigator(false)}
        records={filteredRecords}
        columns={displayColumns}
        currentIndex={currentRowIndex}
        onIndexChange={setCurrentRowIndex}
        onUpdateCell={updateCell}
        relationOptions={relationOptions}
      />
    </>
  );
}
