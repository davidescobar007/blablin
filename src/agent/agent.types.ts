export type AttachmentContentType = "text" | "image" | "pdf" | "unsupported";

export interface AgentAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  contentType: AttachmentContentType;
  textContent?: string;
  base64Content?: string;
}

export interface FunctionCallEntry {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  attachments?: AgentAttachment[];
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  functionCalls?: FunctionCallEntry[];
}

export interface AgentToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: AgentToolParameter;
  properties?: Record<string, AgentToolParameter>;
  required?: string[];
}

export interface AgentToolParameters {
  type: "object";
  properties: Record<string, AgentToolParameter>;
  required?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: AgentToolParameters;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface AgentContextSnapshot {
  isConnected: boolean;
  selectedCollectionName: string | null;
  collectionCount: number;
  totalRecords: number;
  modifiedRecords: number;
  newRecords: number;
  selectedRows: number;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  mode: string;
  visibleColumns: string[];
  aiApiKeyConfigured: boolean;
}

export interface AgentEngineOptions {
  apiKey: string;
  model?: string;
  systemInstruction?: string;
}
