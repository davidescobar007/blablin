import { useState, useEffect, useMemo } from "react";
import { Loader2, Wand2, FileText, X, Eye, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { usePocketBase } from "../../context/usePocketBase";
import { ImagePreviewModal } from "../atoms/Modal";
import type { CellEditorProps } from "./types";
import {
  formatCellValue,
  formatDateForInput,
  parseDateFromInput,
} from "./utils";
import { normalizeAndFormatJSON, isValidJSON } from "../../utils/formatters";

export function CellEditor({
  column,
  value,
  onUpdate,
  record,
  onLoadRelationOptions,
  relationOptions,
  onGenerateAI,
  aiGenerating,
  client,
  isExpanded,
  onToggleExpand,
  onCellFocus,
}: CellEditorProps) {
  const getInitialValue = () => {
    if (column.type === "relation" && value && typeof value === "object" && "id" in value) {
      return (value as { id: string }).id;
    }
    if (column.type === "bool") {
      return String(Boolean(value));
    }
    return formatCellValue(value);
  };

  const initialEditValue = useMemo(() => getInitialValue(), [value, column.type, column.key]);

  // Helper function to get display text for a relation record
  const getRelationDisplayText = (record: any): string => {
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
  };

  const [editValue, setEditValue] = useState<string>(initialEditValue);
  const [error] = useState<string | null>(null);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [isJSONValid, setIsJSONValid] = useState<boolean>(true);

  // Actualizar editValue cuando el valor externo cambia (ej: cuando la IA genera contenido)
  useEffect(() => {
    setEditValue(initialEditValue);
  }, [initialEditValue]);

  // Actualizar validación de JSON para campos json/editor
  useEffect(() => {
    if (column.type === "json" || column.type === "editor") {
      setIsJSONValid(editValue.trim() === "" || isValidJSON(editValue));
    }
  }, [editValue, column.type]);

  const { selectedCollection: currentCollection, getAIConfig: getConfig } =
    usePocketBase();

  const handleCompressedImage = (compressedFile: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    onUpdate(compressedFile);
  };

  const handleConvertToWebP = (webPFile: File) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    onUpdate(webPFile);
  };

  const selectedFile = useMemo(() => {
    if (column.type === "file" && value instanceof File) {
      return value;
    }
    return null;
  }, [value, column.type]);

  const fileName = useMemo(() => {
    if (selectedFile) {
      return selectedFile.name;
    }
    if (typeof value === 'string' && value) {
      return value.split('/').pop() || value;
    }
    return null;
  }, [selectedFile, value]);

  const fileType = useMemo(() => {
    if (selectedFile) {
      return selectedFile.type;
    }
    return null;
  }, [selectedFile]);

  const fileSize = useMemo(() => {
    if (selectedFile) {
      return selectedFile.size;
    }
    return null;
  }, [selectedFile]);

  const previewUrl = useMemo(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      return URL.createObjectURL(selectedFile);
    }
    return null;
  }, [selectedFile]);

  const existingFileUrl = useMemo(() => {
    if (value && !selectedFile && client && record.id && typeof value === 'string') {
      try {
        return client.files.getURL(record, column.key);
      } catch {
        return null;
      }
    }
    return null;
  }, [value, selectedFile, client, record, column.key]);

  const displayUrl = previewUrl || existingFileUrl;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (column.type === "relation" &&
      column.collectionId &&
      onLoadRelationOptions
    ) {
      onLoadRelationOptions(column.collectionId);
    }
  }, [column.type, column.collectionId]);

  const showAIButton =
    !column.system &&
    (column.type === "text" ||
      column.type === "editor" ||
      column.type === "json" ||
      column.type === "email" ||
      column.type === "url" ||
      column.type === "file");

  const hasAIConfig =
    onGenerateAI &&
    currentCollection &&
    getConfig(currentCollection.name, column.key);

  const cellAIGenerating = aiGenerating?.[`${record.id}-${column.key}`];

  const renderInput = () => {
    if (column.type === "text" || column.type === "email" || column.type === "url") {
      return (
        <input
          type={column.type === "email" ? "email" : column.type === "url" ? "url" : "text"}
          value={editValue as string}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => onUpdate(editValue)}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        />
      );
    }

    if (column.type === "number") {
      return (
        <input
          type="number"
          value={editValue as string}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => onUpdate(editValue)}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        />
      );
    }

    if (column.type === "bool") {
      return (
        <input
          type="checkbox"
          checked={Boolean(editValue)}
          onChange={(e) => {
            const newValue = e.target.checked;
            setEditValue(String(newValue));
            onUpdate(newValue);
          }}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        />
      );
    }

    if (column.type === "select" && column.options?.values) {
      return (
        <select
          value={editValue as string}
          onChange={(e) => {
            const newValue = e.target.value;
            setEditValue(newValue);
            onUpdate(newValue || null);
          }}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        >
          <option value="">Select...</option>
          {column.options.values.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (column.type === "relation" && column.collectionId) {
      const options = relationOptions?.[column.collectionId] || [];
      return (
        <select
          value={editValue as string}
          onChange={(e) => {
            setEditValue(e.target.value);
            onUpdate(e.target.value);
          }}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        >
          <option value="">Select...</option>
          {options.map((opt: any) => (
            <option key={opt.id} value={opt.id}>
              {getRelationDisplayText(opt)}
            </option>
          ))}
        </select>
      );
    }

    if (column.type === "date") {
      const includeTime = column.options?.includeTime;
      return (
        <input
          type={includeTime ? "datetime-local" : "date"}
          value={formatDateForInput(value, includeTime)}
          onChange={(e) => {
            const newValue = parseDateFromInput(e.target.value, includeTime);
            setEditValue(newValue || "");
            onUpdate(newValue);
          }}
          onFocus={() => {
            onCellFocus?.(record.id, column.key, value, column);
          }}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={column.system}
          autoComplete="off"
          data-form-type="other"
          aria-label={`Edit ${column.name} for record ${record.id}`}
        />
      );
    }

    if (column.type === "file") {
      const displayPreview = displayUrl || fileName;
      const isImage = fileType?.startsWith("image/") || displayUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

      return (
        <div className="flex items-center gap-2">
          {displayPreview ? (
            <div className="flex items-center gap-2 flex-1">
              {displayPreview && (isImage || selectedFile?.type.startsWith("image/")) ? (
                <div className="relative group">
                  <button
                    onClick={() => setShowImagePreview(true)}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    title="Click to preview"
                  >
                    <img
                      src={displayPreview}
                      alt="Preview"
                      className="h-8 w-8 object-cover rounded border border-slate-300"
                    />
                  </button>
                  <button
                    onClick={() => setShowImagePreview(true)}
                    className="absolute -top-1 -right-1 p-0.5 bg-blue-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Preview in modal"
                  >
                    <Eye className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 max-w-[150px] truncate">
                  <FileText className="w-3 h-3" />
                  <span className="truncate">{fileName || "File"}</span>
                </div>
              )}
              {!column.system && (
                <button
                  onClick={() => onUpdate(null)}
                  className="p-1 text-slate-400 hover:text-red-600"
                  title="Clear file"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
           ) : (
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onUpdate(file);
                }
              }}
              className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={column.system}
              autoComplete="off"
              data-form-type="other"
              aria-label={`Edit ${column.name} for record ${record.id}`}
            />
          )}
          {displayUrl && (
            <button
              onClick={() => {
                window.open(displayUrl, "_blank");
              }}
              className="p-1 text-blue-600 hover:text-blue-800"
              title="Open file"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    if (column.type === "json" || column.type === "editor") {
      const rows = isExpanded
        ? (column.type === "json" ? 10 : 15)
        : (column.type === "json" ? 3 : 5);
      const showInvalidIndicator = editValue.trim() !== "" && !isJSONValid;

      return (
        <div className="relative">
          <textarea
            value={editValue as string}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              const formattedValue = normalizeAndFormatJSON(editValue);
              setEditValue(formattedValue);
              onUpdate(formattedValue);
            }}
            onFocus={() => {
              onCellFocus?.(record.id, column.key, value, column);
            }}
            className={`w-full px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 font-mono ${
              showInvalidIndicator
                ? "border-red-400 focus:ring-red-500"
                : "border-slate-300 focus:ring-blue-500"
            }`}
            rows={rows}
            disabled={column.system}
            autoComplete="off"
            data-form-type="other"
            aria-label={`Edit ${column.name} for record ${record.id}`}
          />
          {showInvalidIndicator && (
            <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 bg-red-100 rounded text-xs text-red-700 font-medium">
              <AlertTriangle className="w-3 h-3" />
              <span>JSON inválido</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={editValue as string}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onUpdate(editValue)}
        onFocus={() => {
          onCellFocus?.(record.id, column.key, value, column);
        }}
        className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={column.system}
        autoComplete="off"
        data-form-type="other"
        aria-label={`Edit ${column.name} for record ${record.id}`}
      />
    );
  };

  return (
    <div className="relative group">
      {cellAIGenerating && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
        </div>
      )}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <div className="flex-1">{renderInput()}</div>
          {column.type === "json" || column.type === "editor" ? (
            <button
              onClick={onToggleExpand}
              className="ml-1 p-1 rounded hover:bg-slate-100 text-slate-600"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : null}
          {showAIButton && onGenerateAI && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGenerateAI(record.id, column.key);
              }}
              disabled={cellAIGenerating || !hasAIConfig}
              className={`ml-1 p-1 rounded transition-colors ${
                cellAIGenerating
                  ? "bg-purple-100 text-purple-600 animate-pulse"
                  : hasAIConfig
                    ? "bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-600"
                    : "bg-transparent text-slate-300 cursor-not-allowed"
              }`}
              title={
                hasAIConfig ? "Generate with AI" : "Configure AI for this column"
              }
            >
              <Wand2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <ImagePreviewModal
        isOpen={showImagePreview}
        onClose={() => setShowImagePreview(false)}
        imageUrl={displayUrl}
        fileName={fileName || undefined}
        fileSize={fileSize || undefined}
        originalFileSize={
          (selectedFile as any)?.compressionInfo?.originalSize || null
        }
        wasCompressed={
          (selectedFile as any)?.compressionInfo?.wasCompressed || false
        }
        fileObject={selectedFile || undefined}
        onCompress={handleCompressedImage}
        defaultQuality={
          currentCollection && column.key
            ? ((getConfig(
                currentCollection.name,
                column.key
              ) as any)?.imageCompressionQuality || 0.7)
            : 0.7
        }
        canConvertToWebP={true}
        onConvertToWebP={handleConvertToWebP}
      />
    </div>
  );
}
