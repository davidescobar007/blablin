import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Wand2, Loader2, FileText, Music, Trash2 } from "lucide-react";
import type PocketBase from "pocketbase";
import { ImagePreviewModal } from "../atoms/Modal";
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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

function isImageValue(v: unknown): boolean {
  if (v instanceof File) return v.type.startsWith("image/");
  if (typeof v === "string") return IMAGE_EXT.test(v.split("?")[0]);
  return false;
}

const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i;

function isAudioValue(v: unknown): boolean {
  if (v instanceof File) return v.type.startsWith("audio/");
  if (typeof v === "string") return AUDIO_EXT.test(v.split("?")[0]);
  return false;
}

/**
 * Renders file field values as image thumbnails (when the file is an image)
 * or a filename chip otherwise. Existing files are resolved to their
 * PocketBase URL; unsaved File objects use an object URL.
 */
function FilePreview({
  value,
  rawRecord,
  client,
  recordId,
  columnKey,
  onUpdateCell,
}: {
  value: unknown;
  rawRecord: Record<string, unknown>;
  client: PocketBase | null;
  recordId?: string;
  columnKey?: string;
  onUpdateCell?: (rowId: string, field: string, value: unknown) => void;
}) {
  const [preview, setPreview] = useState<{
    url: string;
    name: string;
    file: File | null;
    index: number;
  } | null>(null);

  const files = useMemo(
    () =>
      (Array.isArray(value) ? value : [value]).filter(
        (f) => f !== null && f !== undefined && f !== "",
      ),
    [value],
  );

  const objectUrls = useMemo(() => {
    const map = new Map<File, string>();
    files.forEach((f) => {
      if (f instanceof File) map.set(f, URL.createObjectURL(f));
    });
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [objectUrls]);

  const resolvePreview = useCallback(
    (entry: unknown, index: number) => {
      if (entry === null || entry === undefined || entry === "") return null;
      if (!isImageValue(entry)) return null;
      const isFile = entry instanceof File;
      const name = isFile
        ? entry.name
        : String(entry).split("/").pop() || String(entry);
      let url: string | null = null;
      if (isFile) {
        url = objectUrls.get(entry) || null;
      } else if (client && rawRecord?.id) {
        try {
          url = client.files.getURL(rawRecord, String(entry));
        } catch {
          url = null;
        }
      }
      if (!url) return null;
      return { url, name, file: isFile ? entry : null, index };
    },
    [objectUrls, client, rawRecord],
  );

  const openPreview = (index: number) => {
    setPreview(resolvePreview(files[index], index));
  };

  // Follow record navigation (arrow keys / Prev-Next): when the record
  // changes while the modal is open, re-point it at the same field's image
  // in the new record, or close it if that record has none. Keyed on the
  // record id so in-place optimization (which changes the value but not the
  // record) doesn't reset the modal.
  useEffect(() => {
    setPreview((prev) => {
      if (!prev) return prev;
      const next = resolvePreview(files[prev.index], prev.index);
      if (!next) return null;
      if (next.url === prev.url) return prev;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  // Best-effort fetch of an existing stored image into a File so the modal
  // can offer compression / WebP optimization (view-only if blocked by CORS).
  useEffect(() => {
    if (!preview || preview.file || !client) return;
    const { url, name } = preview;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const file = new File([blob], name, { type: blob.type });
        setPreview((prev) =>
          prev && prev.url === url ? { ...prev, file } : prev,
        );
      } catch {
        // ignore — optimization simply won't be offered
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, client]);

  const applyOptimizedFile = (newFile: File) => {
    if (!onUpdateCell || !recordId || !columnKey || !preview) return;
    if (Array.isArray(value)) {
      const next = value.slice();
      next[preview.index] = newFile;
      onUpdateCell(recordId, columnKey, next);
    } else {
      onUpdateCell(recordId, columnKey, newFile);
    }
    setPreview((prev) => (prev ? { ...prev, file: newFile } : prev));
  };

  if (files.length === 0) {
    return <span className="text-slate-400 italic">Empty</span>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => {
          const isFile = f instanceof File;
          const name = isFile
            ? f.name
            : String(f).split("/").pop() || String(f);
          const img = isImageValue(f);

          let thumbUrl: string | null = null;
          let fullUrl: string | null = null;
          if (isFile) {
            fullUrl = objectUrls.get(f) || null;
            thumbUrl = img ? fullUrl : null;
          } else if (client && rawRecord?.id) {
            try {
              fullUrl = client.files.getURL(rawRecord, String(f));
              thumbUrl = img
                ? client.files.getURL(rawRecord, String(f), { thumb: "100x100" })
                : null;
            } catch {
              fullUrl = null;
            }
          }

          if (img && thumbUrl) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => openPreview(i)}
                title={`${name} — view`}
                className="block overflow-hidden rounded border border-slate-200 hover:ring-2 hover:ring-blue-400 transition-shadow"
              >
                <img
                  src={thumbUrl}
                  alt={name}
                  loading="lazy"
                  className="h-16 w-16 object-cover"
                />
              </button>
            );
          }

          if (isAudioValue(f) && fullUrl) {
            return (
              <div key={i} className="w-full space-y-1">
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Music className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate" title={name}>
                    {name}
                  </span>
                </div>
                <audio
                  controls
                  preload="metadata"
                  src={fullUrl}
                  className="w-full h-9"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
            );
          }

          const chip = (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 max-w-[220px]">
              <FileText className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{name}</span>
            </span>
          );
          return fullUrl ? (
            <a
              key={i}
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={name}
            >
              {chip}
            </a>
          ) : (
            <span key={i}>{chip}</span>
          );
        })}
      </div>

      {preview && (
        <ImagePreviewModal
          // Remount per distinct image so no compressed/rotated/zoomed state
          // from a previously opened image leaks into this one. The URL is
          // stable across the async File load and re-optimization of the same
          // image, so those don't trigger an unwanted remount.
          key={preview.url}
          isOpen
          onClose={() => setPreview(null)}
          imageUrl={preview.url}
          fileName={preview.name}
          fileObject={preview.file ?? undefined}
          fileSize={preview.file?.size}
          canConvertToWebP
          onCompress={applyOptimizedFile}
          onConvertToWebP={applyOptimizedFile}
        />
      )}
    </>
  );
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
  onDelete?: () => void;
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
  fileCtx?: {
    rawRecord: Record<string, unknown>;
    client: PocketBase | null;
    recordId: string;
    onUpdateCell: (rowId: string, field: string, value: unknown) => void;
  },
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
      return (
        <FilePreview
          value={value}
          rawRecord={fileCtx?.rawRecord ?? {}}
          client={fileCtx?.client ?? null}
          recordId={fileCtx?.recordId}
          columnKey={col.key}
          onUpdateCell={fileCtx?.onUpdateCell}
        />
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
  onDelete,
}: DetailPanelProps) {
  const { selectedCollection: currentCollection, getAIConfig: getConfig, client } = usePocketBase();
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
      {(showNavigation || stateIndicator || onDelete) && (
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
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete this record"
                    aria-label="Delete this record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              <div className="flex items-center gap-2 flex-shrink-0">
                {stateIndicator && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stateIndicator.bgClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${stateIndicator.color}`} />
                    {stateIndicator.label}
                  </span>
                )}
                {onDelete && (
                  <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete this record"
                    aria-label="Delete this record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
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
                    : formatViewValue(col, record.data[col.key], relationOptions, {
                        rawRecord: record.data,
                        client,
                        recordId: record.id,
                        onUpdateCell,
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
