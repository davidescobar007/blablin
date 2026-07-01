import { useState, useRef } from "react";
import { Download, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import type { AICollectionConfig } from "../../../types/pocketbase.types";

export interface AIConfigImportExportProps {
  onImportSuccess: () => void;
}

interface ExportFileFormat {
  version: number;
  exportedAt: string;
  aiConfigs: Record<string, AICollectionConfig>;
}

export function AIConfigImportExport({ onImportSuccess }: AIConfigImportExportProps) {
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const savedConfigs = localStorage.getItem("pocketbase-ai-configs");
    if (!savedConfigs) {
      setImportError("No hay configuraciones para exportar");
      return;
    }

    try {
      const aiConfigs = JSON.parse(savedConfigs);

      const exportData: ExportFileFormat = {
        version: 1,
        exportedAt: new Date().toISOString(),
        aiConfigs,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      link.download = `pocketbase-ai-configs-${dateStr}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setImportError("Error al procesar las configuraciones");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (!validateImportData(parsed)) {
          setImportError(
            "Invalid file: it must contain an 'aiConfigs' key with the configurations"
          );
          return;
        }

        localStorage.setItem(
          "pocketbase-ai-configs",
          JSON.stringify(parsed.aiConfigs)
        );

        setImportSuccess(true);
        onImportSuccess();

        setTimeout(() => {
          setImportSuccess(false);
        }, 3000);
      } catch {
        setImportError("Failed to read file: invalid JSON");
      }
    };

    reader.onerror = () => {
      setImportError("Failed to read file");
    };

    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateImportData = (
    data: unknown
  ): data is ExportFileFormat => {
    if (typeof data !== "object" || data === null) return false;
    if (!("aiConfigs" in data)) return false;
    if (typeof (data as ExportFileFormat).aiConfigs !== "object") return false;
    return true;
  };

  const dismissMessage = () => {
    setImportError(null);
    setImportSuccess(false);
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Export configuration
        </button>
        <button
          onClick={handleImportClick}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
        >
          <Upload className="w-4 h-4" />
          Import configuration
        </button>
      </div>

      {importSuccess && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-700 font-medium">
              Configuration imported successfully
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              The configurations have been updated
            </p>
          </div>
          <button
            onClick={dismissMessage}
            className="p-1 hover:bg-green-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-green-600" />
          </button>
        </div>
      )}

      {importError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-medium">
              Import error
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {importError}
            </p>
          </div>
          <button
            onClick={dismissMessage}
            className="p-1 hover:bg-red-100 rounded transition-colors"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}
