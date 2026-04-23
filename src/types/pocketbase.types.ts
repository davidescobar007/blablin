import type { CollectionModel } from "pocketbase";

export type AIOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'startsWith';

export interface AIConditionRule {
  id: string;
  column: string;
  operator: AIOperator;
  value: string | number;
  prompt: string;
  variableColumns: string[];
}

export interface AIColumnConfig {
  defaultPrompt: string;
  defaultVariableColumns: string[];
  formatInstructions?: string;
  model?: string;
  generateImage?: boolean;
  imageCompressionQuality?: number;
  conditionalRules?: AIConditionRule[];
}

export type GeminiModelId = string;

export interface GeminiModel {
  id: string;
  name: string;
  description: string;
  category: "stable" | "experimental" | "image";
  type: "text" | "image";
}

export interface AICollectionConfig {
  [columnName: string]: AIColumnConfig;
}

export type RowState = "original" | "modified" | "new" | "saved" | "error";

export interface TrackedRecord {
  id: string;
  data: Record<string, unknown>;
  originalData: Record<string, unknown>;
  state: RowState;
  changes: Record<string, { oldValue: unknown; newValue: unknown }>;
  error?: string;
}

export interface PocketBaseContextType {
  client: any;
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
