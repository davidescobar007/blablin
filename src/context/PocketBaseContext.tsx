import PocketBase from "pocketbase";
import type { CollectionModel } from "pocketbase";
import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AIColumnConfig } from "../types/pocketbase.types";

export const GEMINI_MODELS = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast, efficient model for general tasks",
    category: "stable",
    type: "text" as const,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description: "Pro model for complex tasks and reasoning",
    category: "stable",
    type: "text" as const,
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash (Experimental)",
    description: "Experimental model with multimodal capabilities",
    category: "experimental",
    type: "text" as const,
  },
  {
    id: "imagen-3.0-generate-001",
    name: "Imagen 3.0",
    description: "High-quality image generation model",
    category: "image",
    type: "image" as const,
  },
  {
    id: "imagen-4.0-generate-001",
    name: "Imagen 4.0",
    description: "Most advanced image generation model",
    category: "experimental",
    type: "image" as const,
  },
  {
    id: "gemini-3.1-flash-image-preview",
    name: "Gemini 3.1 Flash Image Preview",
    description: "Multimodal model for generating images",
    category: "experimental",
    type: "image" as const,
  },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export interface AICollectionConfig {
  [columnName: string]: AIColumnConfig;
}

// Row state types
export type RowState = "original" | "modified" | "new" | "saved" | "error";

// Interface for row-level errors
export interface RowError {
  rowId: string;
  message: string;
  timestamp: number;
}

// Interface for tracked record with modification state
export interface TrackedRecord {
  id: string;
  data: Record<string, unknown>;
  originalData: Record<string, unknown>;
  state: RowState;
  changes: Record<string, { oldValue: unknown; newValue: unknown }>;
  error?: string;
}

export interface PocketBaseContextType {
  client: PocketBase | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  collections: CollectionModel[];
  selectedCollection: CollectionModel | null;
  trackedRecords: TrackedRecord[];
  hasChanges: boolean;
  isSaving: boolean;
  saveResult: { success: number; failed: number } | null;
  connect: (url: string, email: string, password: string) => Promise<boolean>;
  connectWithToken: (url: string, apiToken: string) => Promise<boolean>;
  disconnect: () => void;
  selectCollection: (collectionName: string) => Promise<void>;
  refreshRecords: () => Promise<void>;
  updateCell: (rowId: string, field: string, value: unknown) => void;
  addNewRows: (count: number) => void;
  discardChanges: () => void;
  getRecordsForSave: () => {
    create: Record<string, unknown>[];
    update: { id: string; data: Record<string, unknown> }[];
  };
  saveAllChanges: () => Promise<{ success: number; failed: number }>;
  clearRowError: (rowId: string) => void;
  clearSaveResult: () => void;
  aiApiKey: string | null;
  setAIApiKey: (key: string) => void;
  aiConfigs: Record<string, AICollectionConfig>;
  setAIConfig: (
    collectionName: string,
    columnName: string,
    config: AIColumnConfig | null,
  ) => void;
  getAIConfig: (
    collectionName: string,
    columnName: string,
  ) => AIColumnConfig | null;
  reloadAIConfigs: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const PocketBaseContext = createContext<
  PocketBaseContextType | undefined
>(undefined);

export function PocketBaseProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PocketBase | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<CollectionModel[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionModel | null>(null);
  const [trackedRecords, setTrackedRecords] = useState<TrackedRecord[]>([]);
  const [newRowCounter, setNewRowCounter] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  const [aiApiKey, setAIApiKeyState] = useState<string | null>(null);
  const [aiConfigs, setAIConfigs] = useState<
    Record<string, AICollectionConfig>
  >({});

  useEffect(() => {
    const savedKey = localStorage.getItem("pocketbase-ai-api-key");
    if (savedKey) setAIApiKeyState(savedKey);

    const savedConfigs = localStorage.getItem("pocketbase-ai-configs");
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs);
        
        const migratedConfigs: Record<string, Record<string, AIColumnConfig>> = {};
        
        Object.entries(parsedConfigs).forEach(([collectionName, collectionConfig]) => {
          migratedConfigs[collectionName] = {};
          
          Object.entries(collectionConfig as Record<string, any>).forEach(([columnName, columnConfig]) => {
            const config = columnConfig as any;
            
            if (config.prompt !== undefined && config.defaultPrompt === undefined) {
              migratedConfigs[collectionName][columnName] = {
                defaultPrompt: config.prompt,
                defaultVariableColumns: config.variableColumns || [],
                formatInstructions: config.formatInstructions,
                model: config.model,
                generateImage: config.generateImage,
                imageCompressionQuality: config.imageCompressionQuality,
                conditionalRules: [],
              };
            } else {
              migratedConfigs[collectionName][columnName] = config as AIColumnConfig;
            }
          });
        });
        
        setAIConfigs(migratedConfigs);
        
        localStorage.setItem("pocketbase-ai-configs", JSON.stringify(migratedConfigs));
      } catch (error) {
        console.error("[PocketBase] Failed to load AI configs:", error);
      }
    }
  }, []);

  const setAIApiKey = useCallback((key: string) => {
    setAIApiKeyState(key);
    localStorage.setItem("pocketbase-ai-api-key", key);
  }, []);

  const setAIConfig = useCallback(
    (
      collectionName: string,
      columnName: string,
      config: AIColumnConfig | null,
    ) => {
      setAIConfigs((prev) => {
        const newConfigs = { ...prev };
        if (!newConfigs[collectionName]) {
          newConfigs[collectionName] = {};
        }
        if (config) {
          newConfigs[collectionName][columnName] = config;
        } else {
          delete newConfigs[collectionName][columnName];
        }
        localStorage.setItem(
          "pocketbase-ai-configs",
          JSON.stringify(newConfigs),
        );
        return newConfigs;
      });
    },
    [],
  );

  const getAIConfig = useCallback(
    (collectionName: string, columnName: string): AIColumnConfig | null => {
      return aiConfigs[collectionName]?.[columnName] || null;
    },
    [aiConfigs],
  );

  const reloadAIConfigs = useCallback(() => {
    const savedConfigs = localStorage.getItem("pocketbase-ai-configs");
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs);
        setAIConfigs(parsedConfigs);
      } catch (error) {
        console.error("[PocketBase] Failed to reload AI configs:", error);
      }
    } else {
      setAIConfigs({});
    }
  }, []);

  // Computed property for hasChanges
  const hasChanges = trackedRecords.some(
    (r) => r.state === "modified" || r.state === "new",
  );

  const connect = useCallback(
    async (url: string, email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // Log the URL being used for debugging
        console.log("[PocketBase] Attempting to connect to:", url);

        // Normalize URL - remove trailing slashes and ensure proper format
        // PocketBase SDK expects a base URL without /api/ or /_/ suffix
        // It will automatically append the correct API path
        let normalizedUrl = url.trim();

        // Remove trailing slashes
        while (normalizedUrl.endsWith("/")) {
          normalizedUrl = normalizedUrl.slice(0, -1);
        }
        console.log(
          "[PocketBase] After removing trailing slashes:",
          normalizedUrl,
        );

        // If URL contains /_/ (custom proxy path), extract the base URL
        // This is a common setup with tunneling services like sslip.io
        if (normalizedUrl.includes("/_")) {
          const pathIndex = normalizedUrl.indexOf("/_");
          normalizedUrl = normalizedUrl.substring(0, pathIndex);
          console.log(
            "[PocketBase] Removed custom proxy path, using base URL:",
            normalizedUrl,
          );
        } else if (normalizedUrl.endsWith("/api")) {
          // Standard API path - remove it to get base URL
          normalizedUrl = normalizedUrl.slice(0, -4);
          console.log(
            "[PocketBase] Removed /api suffix, using base URL:",
            normalizedUrl,
          );
        }

        console.log("[PocketBase] Final normalized URL:", normalizedUrl);

        const pb = new PocketBase(normalizedUrl);

        // Log before auth attempt
        console.log("[PocketBase] Attempting admin auth with email:", email);
        console.log(
          "[PocketBase] Auth endpoint would be:",
          `${normalizedUrl}/api/admins/auth`,
        );

        // Authenticate as admin
        await pb.admins.authWithPassword(email, password);

        console.log("[PocketBase] Auth successful!");

        setClient(pb);
        setIsConnected(true);

        // Fetch collections
        const collectionsList = await pb.collections.getFullList();
        setCollections(collectionsList);

        return true;
      } catch (err) {
        // Detailed error logging for debugging 405 errors
        console.error("[PocketBase] Connection error details:", err);

        // Check if it's a fetch error with status code
        if (err && typeof err === "object" && "response" in err) {
          const response = (
            err as {
              response?: { status?: number; statusText?: string; url?: string };
            }
          ).response;
          console.error(
            "[PocketBase] HTTP Error:",
            response?.status,
            response?.statusText,
            "URL:",
            response?.url,
          );
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to connect to PocketBase";
        console.error("[PocketBase] Error message:", errorMessage);
        setError(errorMessage);
        setClient(null);
        setIsConnected(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Connect with API token (alternative to password auth)
  const connectWithToken = useCallback(
    async (url: string, apiToken: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(
          "[PocketBase] Attempting to connect with API token to:",
          url,
        );

        // Normalize URL - same as in connect function
        let normalizedUrl = url.trim();
        while (normalizedUrl.endsWith("/")) {
          normalizedUrl = normalizedUrl.slice(0, -1);
        }
        if (normalizedUrl.includes("/_")) {
          const pathIndex = normalizedUrl.indexOf("/_");
          normalizedUrl = normalizedUrl.substring(0, pathIndex);
        } else if (normalizedUrl.endsWith("/api")) {
          normalizedUrl = normalizedUrl.slice(0, -4);
        }

        console.log("[PocketBase] Token auth - normalized URL:", normalizedUrl);

        // Create PocketBase client
        const pb = new PocketBase(normalizedUrl);

        // Set the API token in the auth store
        // This allows using the SDK with an Admin API Key
        // Using type assertion to avoid strict type checking
        pb.authStore.save(apiToken, {
          id: "admin",
          email: "api-token",
          collectionId: "",
          collectionName: "",
        } as any);

        console.log("[PocketBase] Token auth - testing connection...");

        // Test the connection by fetching collections
        const collectionsList = await pb.collections.getFullList();

        setClient(pb);
        setIsConnected(true);
        setCollections(collectionsList);

        console.log("[PocketBase] Token auth successful!");

        return true;
      } catch (err) {
        console.error("[PocketBase] Token auth error:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to connect with API token";
        setError(errorMessage);
        setClient(null);
        setIsConnected(false);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (client) {
      client.authStore.clear();
    }
    setClient(null);
    setIsConnected(false);
    setCollections([]);
    setSelectedCollection(null);
    setTrackedRecords([]);
    setError(null);
  }, [client]);

  const selectCollection = useCallback(
    async (collectionName: string) => {
      if (!client) return;

      const collection = collections.find((c) => c.name === collectionName);
      if (!collection) return;

      setSelectedCollection(collection);
      setIsLoading(true);

      try {
        const recordsList = await client
          .collection(collectionName)
          .getFullList();

        // Convert records to tracked records
        const tracked: TrackedRecord[] = (
          recordsList as Record<string, unknown>[]
        ).map((record) => ({
          id: record.id as string,
          data: { ...record },
          originalData: { ...record },
          state: "original" as RowState,
          changes: {},
        }));

        setTrackedRecords(tracked);
        setNewRowCounter(0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch records";
        setError(errorMessage);
        setTrackedRecords([]);
      } finally {
        setIsLoading(false);
      }
    },
    [client, collections],
  );

  const refreshRecords = useCallback(async () => {
    if (!client || !selectedCollection) return;

    setIsLoading(true);
    try {
      const recordsList = await client
        .collection(selectedCollection.name)
        .getFullList();

      // Convert records to tracked records
      const tracked: TrackedRecord[] = (
        recordsList as Record<string, unknown>[]
      ).map((record) => ({
        id: record.id as string,
        data: { ...record },
        originalData: { ...record },
        state: "original" as RowState,
        changes: {},
      }));

      setTrackedRecords(tracked);
      setNewRowCounter(0);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to refresh records";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [client, selectedCollection]);

  const updateCell = useCallback(
    (rowId: string, field: string, value: unknown) => {
      setTrackedRecords((prev) =>
        prev.map((record) => {
          if (record.id !== rowId) return record;

          const oldValue = record.data[field];

          // If value hasn't changed, don't update
          if (oldValue === value) return record;

          const newData = { ...record.data, [field]: value };
          const isNewRow = record.state === "new";

          // Build changes object
          const newChanges = {
            ...record.changes,
            [field]: { oldValue, newValue: value },
          };

          return {
            ...record,
            data: newData,
            state: isNewRow ? "new" : "modified",
            changes: newChanges,
          };
        }),
      );
    },
    [],
  );

  const addNewRows = useCallback(
    (count: number) => {
      if (!selectedCollection) return;

      const schemaFields = selectedCollection.schema || selectedCollection.fields || [];
      const newRows: TrackedRecord[] = [];

      for (let i = 0; i < count; i++) {
        const newId = `new_${newRowCounter + i + 1}`;
        const emptyData: Record<string, unknown> = { id: newId };

        // Initialize empty values for each schema field
        schemaFields.forEach((field: { name: string }) => {
          emptyData[field.name] = null;
        });

        newRows.push({
          id: newId,
          data: emptyData,
          originalData: { ...emptyData },
          state: "new",
          changes: {},
        });
      }

      setTrackedRecords((prev) => [...prev, ...newRows]);
      setNewRowCounter((prev) => prev + count);
    },
    [selectedCollection, newRowCounter],
  );

  const discardChanges = useCallback(() => {
    // Keep only original records, remove new rows
    setTrackedRecords((prev) =>
      prev.filter((record) => record.state === "original"),
    );
  }, []);

  const getRecordsForSave = useCallback(() => {
    const create: {
      data: Record<string, unknown>;
      hasFiles: boolean;
      formData: FormData | null;
    }[] = [];
    const update: {
      id: string;
      data: Record<string, unknown>;
      hasFiles: boolean;
      formData: FormData | null;
    }[] = [];

    trackedRecords.forEach((record) => {
      if (record.state === "new") {
        // For new records, exclude the temporary ID and system fields
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, originalData, state, changes, ...data } =
          record.data as Record<string, unknown>;

        const hasFiles = Object.values(data).some(
          (value) => value instanceof File,
        );

        if (hasFiles) {
          const formData = new FormData();
          Object.entries(data).forEach(([key, value]) => {
            if (value instanceof File) {
              formData.append(key, value);
            } else if (value !== null && value !== undefined) {
              formData.append(key, String(value));
            }
          });
          create.push({ data, hasFiles, formData });
        } else {
          create.push({ data, hasFiles, formData: null });
        }
      } else if (record.state === "modified") {
        // For modified records, only send changed fields
        const updateData: Record<string, unknown> = {};
        Object.keys(record.changes).forEach((field) => {
          updateData[field] = record.data[field];
        });

        const hasFiles = Object.values(updateData).some(
          (value) => value instanceof File,
        );

        if (hasFiles) {
          const formData = new FormData();
          Object.entries(updateData).forEach(([key, value]) => {
            if (value instanceof File) {
              formData.append(key, value);
            } else if (value !== null && value !== undefined) {
              formData.append(key, String(value));
            }
          });
          update.push({ id: record.id, data: updateData, hasFiles, formData });
        } else {
          update.push({
            id: record.id,
            data: updateData,
            hasFiles,
            formData: null,
          });
        }
      }
    });

    return { create, update };
  }, [trackedRecords]);

  const clearRowError = useCallback((rowId: string) => {
    setTrackedRecords((prev) =>
      prev.map((record) => {
        if (record.id === rowId) {
          return { ...record, error: undefined };
        }
        return record;
      }),
    );
  }, []);

  const clearSaveResult = useCallback(() => {
    setSaveResult(null);
  }, []);

  const saveAllChanges = useCallback(async (): Promise<{
    success: number;
    failed: number;
  }> => {
    if (!client || !selectedCollection) {
      return { success: 0, failed: 0 };
    }

    setIsSaving(true);
    setSaveResult(null);

    // Clear previous errors
    setTrackedRecords((prev) =>
      prev.map((record) => ({ ...record, error: undefined })),
    );

    const { create, update } = getRecordsForSave();
    let successCount = 0;
    let failedCount = 0;

    const newRows = trackedRecords.filter((r) => r.state === "new");

    // Process new rows first (create) - sequentially, one by one
    for (let i = 0; i < create.length; i++) {
      const { data, hasFiles, formData } = create[i];
      try {
        console.log(
          `[PocketBase] Creating record ${i + 1}/${create.length}${hasFiles ? " with files" : ""}`,
        );
        const result = await client
          .collection(selectedCollection.name)
          .create(hasFiles && formData ? formData : data);
        console.log(`[PocketBase] Record created successfully:`, result.id);
        successCount++;

        setTrackedRecords((prev) =>
          prev.map((record) => {
            if (record.id === newRows[i]?.id) {
              return {
                ...record,
                state: "saved" as RowState,
                changes: {},
              };
            }
            return record;
          })
        );
      } catch (err) {
        console.error(`[PocketBase] Failed to create record ${i + 1}:`, err);
        failedCount++;
        if (newRows[i]) {
          setTrackedRecords((prev) =>
            prev.map((record) => {
              if (record.id === newRows[i].id) {
                return {
                  ...record,
                  error:
                    err instanceof Error
                      ? err.message
                      : "Failed to create record",
                  state: "error" as RowState,
                };
              }
              return record;
            }),
          );
        }
      }
    }

    // Process modified rows (update) - sequentially, one by one
    for (let i = 0; i < update.length; i++) {
      const { id, data, hasFiles, formData } = update[i];
      try {
        console.log(
          `[PocketBase] Updating record ${i + 1}/${update.length}:`,
          id,
          hasFiles ? "with files" : "",
        );
        const result = await client
          .collection(selectedCollection.name)
          .update(id, hasFiles && formData ? formData : data);
        console.log(`[PocketBase] Record updated successfully:`, result.id);
        successCount++;

        setTrackedRecords((prev) =>
          prev.map((record) => {
            if (record.id === id) {
              return {
                ...record,
                state: "saved" as RowState,
                changes: {},
              };
            }
            return record;
          })
        );
      } catch (err) {
        console.error(`[PocketBase] Failed to update record ${i + 1}:`, err);
        failedCount++;
        setTrackedRecords((prev) =>
          prev.map((record) => {
            if (record.id === id) {
              return {
                ...record,
                error:
                  err instanceof Error
                    ? err.message
                    : "Failed to update record",
                state: "error" as RowState,
              };
            }
            return record;
          }),
        );
      }
    }

    console.log(
      `[PocketBase] Save completed: ${successCount} success, ${failedCount} failed`,
    );

    // If all succeeded, refresh records to get updated data
    if (failedCount === 0 && successCount > 0) {
      await refreshRecords();
    }

    setSaveResult({ success: successCount, failed: failedCount });
    setIsSaving(false);

    return { success: successCount, failed: failedCount };
  }, [
    client,
    selectedCollection,
    getRecordsForSave,
    refreshRecords,
    trackedRecords,
  ]);

  return (
    <PocketBaseContext.Provider
      value={{
        client,
        isConnected,
        isLoading,
        error,
        collections,
        selectedCollection,
        trackedRecords,
        hasChanges,
        isSaving,
        saveResult,
        connect,
        connectWithToken,
        disconnect,
        selectCollection,
        refreshRecords,
        updateCell,
        addNewRows,
        discardChanges,
        getRecordsForSave,
        saveAllChanges,
        clearRowError,
        clearSaveResult,
        aiApiKey,
        setAIApiKey,
        aiConfigs,
        setAIConfig,
        getAIConfig,
        reloadAIConfigs,
      }}
    >
      {children}
    </PocketBaseContext.Provider>
  );
}
