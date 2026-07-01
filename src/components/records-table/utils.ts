import type { CollectionModel } from "pocketbase";
import type { Column, RowStateIndicator } from "./types";

export function getDisplayColumns(collection: CollectionModel | null): Column[] {
  if (!collection) return [];

  const systemFields: Column[] = [
    { key: "id", name: "ID", type: "text", required: false, system: true },
  ];

  const schemaFields: Column[] =
    (collection.schema || collection.fields || [])?.map(
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
    )?.filter((col: Column) => col.key !== "id") || [];

  return [...systemFields, ...schemaFields];
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatRelationValue(value: unknown, column: Column, relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>): string {
  if (value === null || value === undefined) return "";

  const resolveSingle = (v: unknown): string => {
    if (typeof v === "string" && column.collectionId && relationOptions) {
      const options = relationOptions[column.collectionId] || [];
      const fullRecord = options.find(opt => opt.id === v);
      if (fullRecord) {
        return getRelationDisplayText(fullRecord, column);
      }
      return v;
    }
    if (typeof v === "object" && v !== null && "id" in v) {
      return getRelationDisplayText(v as any, column);
    }
    return String(v);
  };

  if (Array.isArray(value)) {
    return value.map(resolveSingle).join(", ");
  }

  return resolveSingle(value);
}

export function getRelationDisplayText(record: any, column: Column): string {
  if (!record) return '';

  // Use displayFields if provided
  if (column.options?.displayFields && column.options.displayFields.length > 0) {
    const displayParts = column.options.displayFields
      .map((field: string) => {
        const value = record[field];
        return value !== undefined && value !== null ? String(value) : '';
      })
      .filter((part: string) => part !== '');

    if (displayParts.length > 0) {
      return displayParts.join(' - ');
    }
  }

  // Fallback: try to find a common display field
  const commonDisplayFields = ['name', 'title', 'label', 'subject', 'firstName', 'lastName'];
  for (const field of commonDisplayFields) {
    if (record[field] !== undefined && record[field] !== null) {
      return String(record[field]);
    }
  }

  // Last resort: return ID
  return record.id || '';
}

export function getRowStateColor(state: string, hasError?: boolean): string {
  if (hasError || state === "error")
    return "bg-red-50 hover:bg-red-100 border-l-4 border-red-400";
  switch (state) {
    case "new":
      return "bg-green-50 hover:bg-green-100 border-l-4 border-green-400";
    case "modified":
      return "bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-400";
    case "saved":
      return "bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-400";
    default:
      return "bg-slate-50 hover:bg-slate-100 border-l-4 border-slate-300";
  }
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
