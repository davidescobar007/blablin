import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Wand2, Loader2 } from "lucide-react";
import { usePocketBase } from "../../context/usePocketBase";
import type { TrackedRecord } from "../../types/pocketbase.types";
import type { Column } from "./types";
import {
  formatDateForInput,
  parseDateFromInput,
  normalizeAndFormatJSON,
  isValidJSON,
  getRowStateIndicator,
} from "../../utils/formatters";
import { formatRelationValue } from "./utils";

function highlightJSON(json: string): React.ReactNode {
  const lines = json.split("\n");
  return lines.map((line, lineIdx) => {
    const regex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }

      const matched = match[0];
      let className: string = "";

      if (/^"/.test(matched)) {
        if (/:$/.test(matched)) {
          className = "text-blue-600";
        } else {
          className = "text-emerald-600";
        }
      } else if (/true|false/.test(matched)) {
        className = "text-purple-600";
      } else if (/null/.test(matched)) {
        className = "text-slate-400 italic";
      } else {
        className = "text-amber-600";
      }

      parts.push(
        <span key={match.index} className={className}>
          {matched}
        </span>,
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return <div key={lineIdx}>{parts.length > 0 ? parts : line}</div>;
  });
}

interface DetailPanelProps {
  record: TrackedRecord | null;
  columns: Column[];
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
  onUpdateCell: (rowId: string, field: string, value: unknown) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  position?: number;
  total?: number;
  initialEditMode?: boolean;
  className?: string;
  onGenerateAI?: (recordId: string, columnName: string) => void;
  aiGenerating?: Record<string, boolean>;
}

function getPresentableValue(
  opt: { id: string; [key: string]: unknown } | null,
): string {
  if (!opt) return "";
  const presentableFields = [
    "name",
    "title",
    "label",
    "username",
    "email",
    "displayName",
    "fullName",
  ];
  for (const field of presentableFields) {
    if (field in opt && opt[field]) {
      return String(opt[field]);
    }
  }
  return String(opt.id);
}

function formatViewValue(
  col: Column,
  value: unknown,
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>,
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-slate-400 italic">Empty</span>;
  }

  switch (col.type) {
    case "bool":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            value ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {value ? "True" : "False"}
        </span>
      );

    case "date":
      return (
        <span className="text-sm">
          {new Date(String(value)).toLocaleDateString()}
        </span>
      );

    case "datetime":
      return (
        <span className="text-sm">
          {new Date(String(value)).toLocaleString()}
        </span>
      );

    case "select": {
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((v: string) => (
              <span
                key={v}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {v}
              </span>
            ))}
          </div>
        );
      }
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {String(value)}
        </span>
      );
    }

    case "relation": {
      const displayText = formatRelationValue(value, col, relationOptions);
      return (
        <span className="text-sm text-slate-700">
          {displayText || <span className="text-slate-400 italic">Empty</span>}
        </span>
      );
    }

    case "file": {
      const files = Array.isArray(value) ? value : [value];
      return (
        <div className="space-y-1">
          {files.map((f: string, i: number) => (
            <span key={i} className="block text-sm text-slate-700 truncate">
              {String(f)}
            </span>
          ))}
        </div>
      );
    }

    case "json":
    case "editor": {
      const strVal =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      try {
        const parsed = JSON.parse(strVal);
        const formatted = JSON.stringify(parsed, null, 2);
        return (
          <pre className="text-xs font-mono bg-slate-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
            {highlightJSON(formatted)}
          </pre>
        );
      } catch {
        return (
          <pre className="text-xs font-mono bg-slate-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
            {strVal}
          </pre>
        );
      }
    }

    case "text":
    case "email":
    case "url":
      return (
        <span className="text-sm text-slate-700 whitespace-pre-wrap break-words">
          {typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value)}
        </span>
      );

    case "number":
      return <span className="text-sm font-mono">{String(value)}</span>;

    default:
      return (
        <span className="text-sm">
          {typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value)}
        </span>
      );
  }
}

export function DetailPanel({
  record,
  columns,
  relationOptions,
  onUpdateCell,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  position,
  total,
  initialEditMode = false,
  className,
  onGenerateAI,
  aiGenerating,
}: DetailPanelProps) {
  const { selectedCollection: currentCollection, getAIConfig: getConfig } = usePocketBase();
  const editMode = initialEditMode;
  const [editValues, setEditValues] = useState<Record<string, unknown>>(() => {
    if (!record) return {};
    const values: Record<string, unknown> = {};
    columns.forEach((col) => {
      values[col.key] = record.data[col.key];
    });
    return values;
  });
  const [jsonErrors, setJsonErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!record) {
      setEditValues({});
      return;
    }
    const values: Record<string, unknown> = {};
    columns.forEach((col) => {
      values[col.key] = record.data[col.key];
    });
    setEditValues(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, columns]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext?.();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onPrev?.();
      }
    },
    [onPrev, onNext],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleEditValueChange = (key: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
    if (columns.find((c) => c.key === key)?.type === "json") {
      const strVal = String(value || "");
      setJsonErrors((prev) => ({
        ...prev,
        [key]: strVal.trim() !== "" && !isValidJSON(strVal),
      }));
    }
  };

  const handleSaveField = (col: Column) => {
    if (!record) return;
    const value = editValues[col.key];

    if (col.type === "date" || col.type === "datetime") {
      const parsed = parseDateFromInput(
        String(value || ""),
        col.type === "datetime",
      );
      if (parsed !== null) {
        onUpdateCell(record.id, col.key, parsed);
      }
    } else if (col.type === "json") {
      const formatted = normalizeAndFormatJSON(value);
      onUpdateCell(record.id, col.key, formatted);
    } else if (col.type === "number") {
      const num = value === "" ? null : Number(value);
      onUpdateCell(record.id, col.key, num);
    } else {
      onUpdateCell(record.id, col.key, value);
    }
  };

  const renderEditField = (col: Column) => {
    const value = editValues[col.key];

    switch (col.type) {
      case "bool":
        return (
          <button
            onClick={() => handleEditValueChange(col.key, !value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        );

      case "number":
        return (
          <input
            type="number"
            value={value === null ? "" : String(value)}
            onChange={(e) =>
              handleEditValueChange(
                col.key,
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            onBlur={() => handleSaveField(col)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={formatDateForInput(value)}
            onChange={(e) => handleEditValueChange(col.key, e.target.value)}
            onBlur={() => handleSaveField(col)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "datetime":
        return (
          <input
            type="datetime-local"
            value={formatDateForInput(value, true)}
            onChange={(e) => handleEditValueChange(col.key, e.target.value)}
            onBlur={() => handleSaveField(col)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "select": {
        const options = col.options?.values || [];
        const maxSelect = col.options?.maxSelect;
        const isMulti = maxSelect !== undefined && maxSelect > 1;
        const selectedValues = Array.isArray(value)
          ? value.map(String)
          : value
            ? [String(value)]
            : [];

        if (isMulti) {
          return (
            <select
              multiple
              value={selectedValues}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                handleEditValueChange(
                  col.key,
                  selected.length > 0 ? selected : null,
                );
              }}
              onBlur={() => handleSaveField(col)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            >
              {options.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );
        }

        return (
          <select
            value={selectedValues[0] || ""}
            onChange={(e) =>
              handleEditValueChange(
                col.key,
                e.target.value === "" ? null : e.target.value,
              )
            }
            onBlur={() => handleSaveField(col)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {options.map((opt: string) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case "relation": {
        const relationOpts =
          relationOptions?.[col.collectionId || ""] || [];
        const maxSelect = col.options?.maxSelect;
        const isMulti = maxSelect !== undefined && maxSelect > 1;
        const selectedIds = Array.isArray(value)
          ? value.map(String)
          : value
            ? [String(value)]
            : [];

        if (isMulti) {
          return (
            <select
              multiple
              value={selectedIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(
                  (o) => o.value,
                );
                handleEditValueChange(
                  col.key,
                  selected.length > 0 ? selected : null,
                );
              }}
              onBlur={() => handleSaveField(col)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            >
              {relationOpts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {getPresentableValue(opt)}
                </option>
              ))}
            </select>
          );
        }

        return (
          <select
            value={selectedIds[0] || ""}
            onChange={(e) =>
              handleEditValueChange(
                col.key,
                e.target.value === "" ? null : e.target.value,
              )
            }
            onBlur={() => handleSaveField(col)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {relationOpts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {getPresentableValue(opt)}
              </option>
            ))}
          </select>
        );
      }

      case "json": {
        const displayValue =
          typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value || "");
        const showInvalid =
          displayValue.trim() !== "" && jsonErrors[col.key];
        return (
          <div className="relative">
            <textarea
              value={displayValue}
              onChange={(e) => handleEditValueChange(col.key, e.target.value)}
              onBlur={() => handleSaveField(col)}
              rows={6}
              className={`w-full px-3 py-2 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 ${
                showInvalid
                  ? "border-red-400 focus:ring-red-500"
                  : "border-slate-300 focus:ring-blue-500"
              } border`}
            />
            {showInvalid && (
              <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded text-xs text-red-700 font-medium">
                <span>Invalid JSON</span>
              </div>
            )}
          </div>
        );
      }

      case "editor":
        return (
          <textarea
            value={
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value || "")
            }
            onChange={(e) => handleEditValueChange(col.key, e.target.value)}
            onBlur={() => handleSaveField(col)}
            rows={8}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case "text":
      case "email":
      case "url":
        return (
          <textarea
            value={value === null ? "" : String(value)}
            onChange={(e) => {
              handleEditValueChange(col.key, e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onBlur={() => handleSaveField(col)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            onInput={(e) => {
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
            }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }
            }}
          />
        );

      case "file":
        return (
          <div className="text-sm text-slate-500 italic">
            File fields cannot be edited here
          </div>
        );

      default:
        return (
          <textarea
            value={
              typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value || "")
            }
            onChange={(e) => handleEditValueChange(col.key, e.target.value)}
            onBlur={() => handleSaveField(col)}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        );
    }
  };

  if (!record) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-8">
        <p className="text-sm">Select a row to view details</p>
      </div>
    );
  }

  const stateIndicator = getRowStateIndicator(record.state);
  const showNavigation = onPrev && onNext && position !== undefined && total !== undefined;

  return (
    <div className={className}>
      {(showNavigation || stateIndicator) && (
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
          {showNavigation ? (
            <>
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Row {position! + 1} of {total}
                </span>
                {stateIndicator && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stateIndicator.bgClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${stateIndicator.color}`} />
                    {stateIndicator.label}
                  </span>
                )}
              </div>

              <button
                onClick={onNext}
                disabled={!hasNext}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full justify-between">
              <span className="text-sm font-medium text-slate-700 truncate">
                {record.id}
              </span>
              {stateIndicator && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stateIndicator.bgClass}`}
                >
                  <span className={`w-2 h-2 rounded-full ${stateIndicator.color}`} />
                  {stateIndicator.label}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="space-y-3">
          {columns.map((col) => {
            console.log("[DetailPanel] rendering col:", col.name, "type:", col.type, "editMode:", editMode, "value:", record?.data[col.key]);
            const showAIButton =
              !col.system &&
              (col.type === "text" ||
                col.type === "editor" ||
                col.type === "json" ||
                col.type === "email" ||
                col.type === "url" ||
                col.type === "file");
            const hasAIConfig =
              onGenerateAI &&
              currentCollection &&
              getConfig(currentCollection.name, col.key);
            const isGenerating = aiGenerating?.[`${record?.id ?? ""}-${col.key}`];
            return (
              <div
                key={col.key}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {col.name}
                    </span>
                    {col.system && (
                      <span className="text-xs text-slate-400">(system)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {showAIButton && onGenerateAI && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (record) onGenerateAI(record.id, col.key);
                        }}
                        disabled={isGenerating || !hasAIConfig}
                        className={`p-1 rounded transition-colors ${
                          isGenerating
                            ? "bg-purple-100 text-purple-600 animate-pulse"
                            : hasAIConfig
                              ? "bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-600"
                              : "bg-transparent text-slate-300 cursor-not-allowed"
                        }`}
                        title={
                          isGenerating
                            ? "Generating..."
                            : hasAIConfig
                              ? "Generate with AI"
                              : "Configure AI for this column"
                        }
                        aria-label={`Generate AI for ${col.name}`}
                      >
                        {isGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                    <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">
                      {col.type}
                    </span>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  {editMode
                    ? renderEditField(col)
                    : formatViewValue(col, record.data[col.key], relationOptions)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
