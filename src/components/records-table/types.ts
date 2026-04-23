import type { TrackedRecord } from "../../context/PocketBaseContext";
import PocketBase from "pocketbase";

export interface SchemaFieldOptions {
  collectionId?: string;
  cascadeDelete?: boolean;
  displayFields?: string[];
  maxSelect?: number;
  values?: string[];
  includeTime?: boolean;
  maxSize?: number;
  mimeTypes?: string[];
  richTextFormat?: string;
  [key: string]: unknown;
}

export interface Column {
  key: string;
  name: string;
  type: string;
  required: boolean;
  system?: boolean;
  options?: SchemaFieldOptions;
  collectionId?: string;
}

export interface CellEditorProps {
  record: TrackedRecord;
  column: Column;
  value: unknown;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (newValue: unknown) => void;
  onCellFocus?: (
    recordId: string,
    field: string,
    value: unknown,
    column: Column,
  ) => void;
  onLoadRelationOptions?: (collectionId: string) => void;
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
  onGenerateAI?: (recordId: string, columnName: string) => void;
  aiGenerating?: Record<string, boolean>;
  client?: PocketBase | null;
}

export interface RowStateIndicator {
  color: string;
  label: string;
  bgClass: string;
}
