import type { Column } from "../types/records.types";
import type { CollectionModel } from "pocketbase";

export function getDisplayColumns(collection: CollectionModel | null): Column[] {
  if (!collection) return [];

  const systemFields: Column[] = [
    { key: "id", name: "ID", type: "text", required: false, system: true },
  ];

  const schemaFields: Column[] =
    collection.schema?.map(
      (field: {
        name: string;
        type: string;
        required: boolean;
        options?: any;
      }) => {
        let collectionId: string | undefined;
        if (field.type === "relation" && field.options) {
          collectionId = field.options.collectionId as string | undefined;
        }

        return {
          key: field.name,
          name: field.name,
          type: field.type,
          required: field.required,
          system: false,
          options: field.options || {},
          collectionId,
        };
      },
    ) || [];

  return [...systemFields, ...schemaFields];
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function isValidJSON(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function formatDateForInput(value: unknown, includeTime?: boolean): string {
  if (!value) return "";

  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const dateStr = date.toISOString().split("T")[0];
      if (includeTime) {
        const timeStr = date.toTimeString().slice(0, 5);
        return `${dateStr}T${timeStr}`;
      }
      return dateStr;
    }
    return value as string;
  }

  return "";
}

export function parseDateFromInput(
  value: string,
  includeTime?: boolean,
): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  if (includeTime) {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }

  return value.split("T")[0];
}

export function getColumnSize(col: Column): number {
  if (col.system) return 100;
  if (col.type === "json") return 300;
  if (col.type === "editor") return 400;
  if (col.type === "text") return 200;
  if (col.type === "email") return 200;
  if (col.type === "url") return 200;
  if (col.type === "number") return 100;
  if (col.type === "bool") return 80;
  if (col.type === "date") return 150;
  if (col.type === "select") return 150;
  if (col.type === "relation") return 200;
  if (col.type === "file") return 150;
  return 150;
}

export function getRowStateColor(state: string, hasError?: boolean): string {
  if (hasError)
    return "bg-red-50 hover:bg-red-100 border-l-4 border-red-400";
  switch (state) {
    case "new":
      return "bg-green-50 hover:bg-green-100 border-l-4 border-green-400";
    case "modified":
      return "bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-400";
    default:
      return "bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-300";
  }
}

export interface RowStateIndicator {
  color: string;
  label: string;
  bgClass: string;
}

export function getRowStateIndicator(
  state: string,
  hasError?: boolean,
): RowStateIndicator | null {
  if (hasError)
    return { color: "bg-red-500", label: "Error", bgClass: "bg-red-100" };
  switch (state) {
    case "new":
      return { color: "bg-green-500", label: "New", bgClass: "bg-green-100" };
    case "modified":
      return {
        color: "bg-amber-500",
        label: "Modified",
        bgClass: "bg-amber-100",
      };
    default:
      return null;
  }
}

function escapeString(str: string, quoteChar: '"' | "'"): string {
  if (quoteChar === '"') {
    return str.replace(/"/g, '\\"');
  } else {
    return str.replace(/'/g, "\\'");
  }
}

function isEscaped(pos: number, str: string): boolean {
  let count = 0;
  for (let i = pos - 1; i >= 0; i--) {
    if (str[i] === '\\') {
      count++;
    } else {
      break;
    }
  }
  return count % 2 === 1;
}

function convertSingleToDoubleQuotes(str: string): string {
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    if (str[i] === "'") {
      let end = i + 1;
      let hasContent = false;
      
      while (end < str.length) {
        if (str[end] === "'" && !isEscaped(end, str)) {
          hasContent = true;
          break;
        }
        end++;
      }
      
      if (hasContent) {
        const content = str.substring(i + 1, end);
        const escapedContent = escapeString(content, '"');
        result += '"' + escapedContent + '"';
        i = end + 1;
        continue;
      }
    }
    
    if (str[i] === '"') {
      let end = i + 1;
      let hasContent = false;
      
      while (end < str.length) {
        if (str[end] === '"' && !isEscaped(end, str)) {
          hasContent = true;
          break;
        }
        end++;
      }
      
      if (hasContent) {
        const content = str.substring(i + 1, end);
        const convertedContent = content.replace(/'/g, '"');
        const escapedContent = escapeString(convertedContent, '"');
        result += '"' + escapedContent + '"';
        i = end + 1;
        continue;
      }
    }
    
    result += str[i];
    i++;
  }
  
  return result;
}

export function normalizeAndFormatJSON(value: unknown): string {
  if (value === null || value === undefined) return "";

  const strValue = String(value);

  try {
    const parsed = JSON.parse(strValue);
    return JSON.stringify(parsed, null, 2);
  } catch {
    const normalized = convertSingleToDoubleQuotes(strValue);
    try {
      const parsed = JSON.parse(normalized);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return strValue;
    }
  }
}
