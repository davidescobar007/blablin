import { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { usePocketBase } from "../context/usePocketBase";
import type { AgentMessage, AgentContextSnapshot, AgentAttachment } from "./agent.types";
import type { TrackedRecord } from "../types/pocketbase.types";
import { buildTools } from "./agent.tools";
import { runAgentLoop } from "./agent.engine";
import { GEMINI_MODELS, type GeminiModelId } from "../constants/ai.models";

function matchesFilter(record: TrackedRecord, column?: string, value?: string): boolean {
  if (!column || value === undefined) return true;
  const recordValue = record.data[column];
  const strValue = recordValue === null || recordValue === undefined ? "" : String(recordValue);
  return strValue.toLowerCase().includes(String(value).toLowerCase());
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getFilteredRecords(
  records: TrackedRecord[],
  selectedRows: string[],
  scope?: "all" | "selected",
  filterColumn?: string,
  filterValue?: string,
): TrackedRecord[] {
  let result = records;

  if (scope === "selected") {
    const selectedSet = new Set(selectedRows);
    result = result.filter((r) => selectedSet.has(r.id));
  }

  if (filterColumn && filterValue !== undefined) {
    result = result.filter((r) => matchesFilter(r, filterColumn, filterValue));
  }

  return result;
}

function getColumnValues(records: TrackedRecord[], columnName: string, maxLength = 15000): string {
  const values = records
    .map((r) => formatCellValue(r.data[columnName]))
    .filter((v) => v.trim() !== "");

  if (values.length === 0) {
    return `No hay valores para la columna "${columnName}".`;
  }

  const joined = values.map((v, i) => `[${i + 1}] ${v}`).join("\n\n---\n\n");
  if (joined.length > maxLength) {
    return joined.slice(0, maxLength) + `\n\n... (truncado, ${values.length} valores en total)`;
  }

  return joined;
}

async function summarizeWithAI(
  apiKey: string,
  columnName: string,
  valuesText: string,
  recordCount: number,
  model: string = "gemini-2.5-flash",
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    "Resume los siguientes valores de la columna",
    `"${columnName}"`,
    `de ${recordCount} registros.`,
    "Extrae los puntos clave, temas comunes y conclusiones principales.",
    "Responde en español o inglés según el idioma del contenido.",
    "\n\nValores:\n",
    valuesText,
  ].join(" ");

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return response.text || "No se pudo generar el resumen.";
}

export function useAgent(
  actions: {
    setGlobalSearch: (query: string) => void;
    clearAllFilters: () => void;
    setColumnFilter: (columnKey: string, value: string) => void;
    setMode: (mode: string) => void;
    handleSelectAllBool: (checked: boolean) => void;
    handleBulkGenerateAI: (columnNames?: string[]) => Promise<void>;
    setShowAISettings: (show: boolean) => void;
    setShowAIColumnConfig: (columnName: string) => void;
    setShowImportJsonDialog: (show: boolean) => void;
    setShowExportDialog: (show: boolean) => void;
    handleRequestDelete: (ids: string[]) => void;
    filteredRecords: TrackedRecord[];
    selectedRows: string[];
    mode: string;
    hasActiveFilters: boolean;
    activeFilterCount: number;
  },
  contextSnapshot: AgentContextSnapshot,
) {
  const {
    aiApiKey,
    addNewRows,
    saveAllChanges,
    discardChanges,
    refreshRecords,
    trackedRecords,
    selectedCollection,
    client,
    collections,
  } = usePocketBase();

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      role: "assistant",
      content: "¡Hola! Soy tu asistente de PocketBase. Pídeme cosas como: 'selecciona los primeros 5', 'rellena la descripción con AI', 'guarda los cambios', 'muéstrame solo los activos', 'resumen de content de los A1.1', etc.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const AGENT_MODEL_STORAGE_KEY = "pocketbase-agent-model";
  const DEFAULT_AGENT_MODEL: GeminiModelId = "gemini-2.5-flash";

  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(() => {
    const saved = localStorage.getItem(AGENT_MODEL_STORAGE_KEY);
    const valid = saved && GEMINI_MODELS.some((m) => m.id === saved && m.type === "text");
    return valid ? (saved as GeminiModelId) : DEFAULT_AGENT_MODEL;
  });

  useEffect(() => {
    localStorage.setItem(AGENT_MODEL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  const agentActions = useMemo(
    () => ({
      getContext: () => {
        const lines = [
          `Conectado: ${contextSnapshot.isConnected ? "sí" : "no"}`,
          `Colección seleccionada: ${contextSnapshot.selectedCollectionName || "ninguna"}`,
          `Total de colecciones: ${contextSnapshot.collectionCount}`,
          `Registros visibles: ${contextSnapshot.totalRecords}`,
          `Registros modificados: ${contextSnapshot.modifiedRecords}`,
          `Registros nuevos: ${contextSnapshot.newRecords}`,
          `Filas seleccionadas: ${contextSnapshot.selectedRows}`,
          `Filtros activos: ${contextSnapshot.hasActiveFilters ? "sí" : "no"} (${contextSnapshot.activeFilterCount})`,
          `Modo de vista: ${contextSnapshot.mode}`,
          `Columnas visibles: ${contextSnapshot.visibleColumns.join(", ") || "ninguna"}`,
          `API key AI configurada: ${contextSnapshot.aiApiKeyConfigured ? "sí" : "no"}`,
          `Total de registros cargados: ${trackedRecords.length}`,
        ];
        return lines.join("\n");
      },
      addNewRows: async (count: number) => {
        addNewRows(count);
        return `Añadidas ${count} fila(s) nueva(s).`;
      },
      saveChanges: async () => {
        const result = await saveAllChanges();
        return `Guardado completado: ${result.success} éxito, ${result.failed} fallo(s).`;
      },
      discardChanges: () => {
        discardChanges();
        return "Cambios descartados.";
      },
      refreshRecords: async () => {
        await refreshRecords();
        return "Registros recargados.";
      },
      clearFilters: () => {
        actions.clearAllFilters();
        return "Filtros limpiados.";
      },
      setGlobalSearch: (query: string) => {
        actions.setGlobalSearch(query);
        return `Búsqueda global aplicada: "${query}".`;
      },
      setColumnFilter: (columnKey: string, value: string) => {
        actions.setColumnFilter(columnKey, value);
        return `Filtro aplicado: ${columnKey} contiene "${value}".`;
      },
      switchMode: (mode: string) => {
        actions.setMode(mode);
        return `Modo cambiado a ${mode}.`;
      },
      selectAllRows: () => {
        actions.handleSelectAllBool(true);
        return `Seleccionadas ${actions.filteredRecords.length} fila(s).`;
      },
      clearSelection: () => {
        actions.handleSelectAllBool(false);
        return "Selección limpiada.";
      },
      fillWithAI: async (columnNames: string[]) => {
        await actions.handleBulkGenerateAI(columnNames);
        return `Generación AI completada para columnas: ${columnNames.join(", ")}.`;
      },
      showAISettings: () => {
        actions.setShowAISettings(true);
        return "Diálogo de configuración AI abierto.";
      },
      configureAIColumn: (columnName: string) => {
        actions.setShowAIColumnConfig(columnName);
        return `Diálogo de configuración AI abierto para columna ${columnName}.`;
      },
      showImportDialog: () => {
        actions.setShowImportJsonDialog(true);
        return "Diálogo de importación abierto.";
      },
      showExportDialog: () => {
        actions.setShowExportDialog(true);
        return "Diálogo de exportación abierto.";
      },
      deleteSelected: async () => {
        const ids = actions.selectedRows;
        if (ids.length === 0) return "No hay filas seleccionadas para eliminar.";
        actions.handleRequestDelete(ids);
        return `Solicitada eliminación de ${ids.length} registro(s). Confirma en el diálogo.`;
      },
      getColumnValues: async (
        columnName: string,
        filterColumn?: string,
        filterValue?: string,
        scope?: "all" | "selected",
      ) => {
        if (!selectedCollection) return "No hay ninguna colección seleccionada.";

        const records = getFilteredRecords(
          trackedRecords,
          actions.selectedRows,
          scope,
          filterColumn,
          filterValue,
        );

        if (records.length === 0) {
          return `No se encontraron registros${filterColumn && filterValue !== undefined ? ` con ${filterColumn} = "${filterValue}"` : ""}.`;
        }

        const valuesText = getColumnValues(records, columnName);
        return `Valores de "${columnName}" (${records.length} registros):\n\n${valuesText}`;
      },
      summarizeColumnValues: async (
        columnName: string,
        filterColumn?: string,
        filterValue?: string,
        scope?: "all" | "selected",
      ) => {
        if (!selectedCollection) return "No hay ninguna colección seleccionada.";
        if (!aiApiKey) return "No hay API key de Gemini configurada.";

        const records = getFilteredRecords(
          trackedRecords,
          actions.selectedRows,
          scope,
          filterColumn,
          filterValue,
        );

        if (records.length === 0) {
          return `No se encontraron registros${filterColumn && filterValue !== undefined ? ` con ${filterColumn} = "${filterValue}"` : ""}.`;
        }

        const valuesText = getColumnValues(records, columnName);
        const summary = await summarizeWithAI(
          aiApiKey,
          columnName,
          valuesText,
          records.length,
        );

        return `Resumen de "${columnName}" para ${records.length} registros:\n\n${summary}`;
      },
      bulkCreateRecords: async (records: Record<string, unknown>[], collectionName?: string) => {
        if (!client) {
          return "No hay conexión a PocketBase.";
        }
        if (records.length === 0) {
          return "No hay registros para crear.";
        }

        const targetName = collectionName || selectedCollection?.name;
        if (!targetName) {
          return "No hay colección seleccionada ni especificada.";
        }

        const collectionExists = collections.some((c) => c.name === targetName);
        if (!collectionExists) {
          return `La colección "${targetName}" no existe. Colecciones disponibles: ${collections.map((c) => c.name).join(", ")}`;
        }

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < records.length; i++) {
          try {
            await client.collection(targetName).create(records[i]);
            success++;
          } catch (error) {
            failed++;
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push(`Fila ${i + 1}: ${message}`);
          }
        }

        await refreshRecords();

        let result = `Importación completada en "${targetName}": ${success} éxito, ${failed} fallo(s).`;
        if (errors.length > 0) {
          result += "\n\nErrores:\n" + errors.slice(0, 10).join("\n");
          if (errors.length > 10) {
            result += `\n... y ${errors.length - 10} más.`;
          }
        }
        return result;
      },
      bulkUpdateRecords: async (
        updates: { id: string; data: Record<string, unknown> }[],
        collectionName?: string,
      ) => {
        if (!client) {
          return "No hay conexión a PocketBase.";
        }
        if (updates.length === 0) {
          return "No hay actualizaciones para aplicar.";
        }

        const targetName = collectionName || selectedCollection?.name;
        if (!targetName) {
          return "No hay colección seleccionada ni especificada.";
        }

        const collectionExists = collections.some((c) => c.name === targetName);
        if (!collectionExists) {
          return `La colección "${targetName}" no existe. Colecciones disponibles: ${collections.map((c) => c.name).join(", ")}`;
        }

        let success = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < updates.length; i++) {
          const { id, data } = updates[i];
          try {
            await client.collection(targetName).update(id, data);
            success++;
          } catch (error) {
            failed++;
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push(`ID ${id}: ${message}`);
          }
        }

        await refreshRecords();

        let result = `Actualización completada en "${targetName}": ${success} éxito, ${failed} fallo(s).`;
        if (errors.length > 0) {
          result += "\n\nErrores:\n" + errors.slice(0, 10).join("\n");
          if (errors.length > 10) {
            result += `\n... y ${errors.length - 10} más.`;
          }
        }
        return result;
      },
      getRecords: async (
        collectionName: string,
        filterColumn?: string,
        filterValue?: string,
        limit: number = 500,
      ) => {
        if (!client) {
          return "No hay conexión a PocketBase.";
        }

        const collectionExists = collections.some((c) => c.name === collectionName);
        if (!collectionExists) {
          return `La colección "${collectionName}" no existe. Colecciones disponibles: ${collections.map((c) => c.name).join(", ")}`;
        }

        try {
          const rawRecords = await client.collection(collectionName).getFullList({
            sort: "-created",
          });

          let records = rawRecords as unknown as Record<string, unknown>[];

          if (filterColumn && filterValue !== undefined) {
            records = records.filter((r) => {
              const value = r[filterColumn];
              return String(value ?? "").toLowerCase().includes(String(filterValue).toLowerCase());
            });
          }

          if (records.length > limit) {
            records = records.slice(0, limit);
          }

          return `Registros de "${collectionName}" (${records.length}):\n\n${JSON.stringify(records, null, 2)}`;
        } catch (error) {
          return `Error consultando ${collectionName}: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      },
    }),
    [
      contextSnapshot,
      addNewRows,
      saveAllChanges,
      discardChanges,
      refreshRecords,
      actions,
      trackedRecords,
      selectedCollection,
      aiApiKey,
      client,
      collections,
    ],
  );

  const tools = useMemo(() => buildTools(agentActions), [agentActions]);

  const sendMessage = useCallback(
    async (content: string, attachments: AgentAttachment[] = []) => {
      if (!aiApiKey) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Necesitas configurar una API key de Gemini primero. Puedes abrir la configuración de AI." },
        ]);
        return;
      }

      const userMessage: AgentMessage = { role: "user", content, attachments };
      const nextHistory = [...messages, userMessage];
      setMessages(nextHistory);
      setIsLoading(true);

      try {
        // El modelo es el elegido por el usuario en el selector del chat.
        // No sobrescribir por adjuntos: el usuario controla directamente.
        const model = selectedModel;

        const { messages: updatedHistory } = await runAgentLoop(
          { apiKey: aiApiKey, model },
          nextHistory,
          tools,
          15,
          (progressMessages) => setMessages(progressMessages),
        );
        setMessages(updatedHistory);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error del agente";
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errorMessage}` }]);
      } finally {
        setIsLoading(false);
      }
    },
    [aiApiKey, messages, tools, selectedModel],
  );

  return { messages, isLoading, isOpen, setIsOpen, sendMessage, selectedModel, setSelectedModel };
}
