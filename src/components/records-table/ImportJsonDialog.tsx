import { useState, useCallback, useEffect, useMemo } from "react";
import { Upload, CheckCircle2, XCircle, AlertTriangle, X, Info, Loader2, ChevronRight } from "lucide-react";
import type { CollectionField } from "pocketbase";

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ index: number; record: unknown; error: string }>;
}

interface ImportJsonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  collectionSchema: Array<CollectionField>;
  onImport: (data: unknown[]) => Promise<ImportResult>;
}

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

interface SchemaWarning {
  message: string;
}

export function ImportJsonDialog({
  isOpen,
  onClose,
  collectionName,
  collectionSchema,
  onImport,
}: ImportJsonDialogProps) {
  const [jsonContent, setJsonContent] = useState("");
  const [parsedData, setParsedData] = useState<unknown[] | null>(null);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [schemaWarnings, setSchemaWarnings] = useState<SchemaWarning[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showSchemaInfo, setShowSchemaInfo] = useState(false);
  const [showFailedRecords, setShowFailedRecords] = useState(false);
  const MAX_RECORDS = 500;

  const schemaFieldNames = useMemo(() => new Set(collectionSchema.map((f) => f.name)), [collectionSchema]);

  const resetState = useCallback(() => {
    setJsonContent("");
    setParsedData(null);
    setValidationError(null);
    setSchemaWarnings([]);
    setResult(null);
    setShowSchemaInfo(false);
    setShowFailedRecords(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      resetState();
      onClose();
    }
  }, [isImporting, resetState, onClose]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonContent(content);
    };
    reader.onerror = () => {
      setValidationError({ message: "Failed to read file" });
    };
    reader.readAsText(file);
  }, []);

  const validateJson = useCallback((json: string): { data: unknown[] | null; error: ValidationError | null } => {
    try {
      const parsed = JSON.parse(json);
      
      if (!Array.isArray(parsed)) {
        return { data: null, error: { message: "JSON must be an array of objects" } };
      }

      if (parsed.length === 0) {
        return { data: null, error: { message: "JSON array is empty" } };
      }

      if (parsed.length > MAX_RECORDS) {
        return { 
          data: null, 
          error: { message: `Too many records: ${parsed.length} (max: ${MAX_RECORDS})` } 
        };
      }

      return { data: parsed, error: null };
    } catch (err) {
      if (err instanceof SyntaxError) {
        const match = err.message.match(/position (\d+)/);
        const pos = match ? parseInt(match[1], 10) : null;
        return { 
          data: null, 
          error: { 
            message: `Invalid JSON: ${err.message}`,
            line: pos ? Math.ceil(pos / 80) : undefined,
            column: pos ? pos % 80 : undefined
          } 
        };
      }
      return { data: null, error: { message: "Invalid JSON format" } };
    }
  }, [MAX_RECORDS]);

  const validateAgainstSchema = useCallback((data: unknown[]): SchemaWarning[] => {
    const warnings: SchemaWarning[] = [];
    const extraFields = new Set<string>();

    data.forEach((record) => {
      if (typeof record === "object" && record !== null) {
        Object.keys(record).forEach((field) => {
          if (!schemaFieldNames.has(field)) {
            extraFields.add(field);
          }
        });
      }
    });

    if (extraFields.size > 0) {
      warnings.push({
        message: `Extra fields detected: ${Array.from(extraFields).join(", ")} (will be ignored by PocketBase)`,
      });
    }

    return warnings;
  }, [schemaFieldNames]);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    if (!jsonContent.trim()) {
      setParsedData(null);
      setValidationError(null);
      setSchemaWarnings([]);
      return;
    }

    const { data, error } = validateJson(jsonContent);
    
    if (error) {
      setParsedData(null);
      setValidationError(error);
      setSchemaWarnings([]);
    } else if (data) {
      setParsedData(data);
      setValidationError(null);
      const warnings = validateAgainstSchema(data);
      setSchemaWarnings(warnings);
    }
  }, [jsonContent, validateJson, validateAgainstSchema]);

  const handleImport = useCallback(async () => {
    if (!parsedData) return;

    setIsImporting(true);
    setProgress({ current: 0, total: parsedData.length });
    setResult(null);

    try {
      const importResult = await onImport(parsedData);
      setResult(importResult);
      
      if (importResult.failed === 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error("[ImportJsonDialog] Import failed:", error);
      setResult({
        success: 0,
        failed: parsedData.length,
        errors: Array.from({ length: parsedData.length }, (_, i) => ({
          index: i + 1,
          record: parsedData[i],
          error: error instanceof Error ? error.message : "Unknown error",
        })),
      });
    } finally {
      setIsImporting(false);
    }
  }, [parsedData, onImport, handleClose]);

  const isValid = parsedData !== null && !validationError;
  const canImport = isValid && !isImporting && parsedData.length > 0;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-800">
                  Import Records from JSON
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSchemaInfo(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  disabled={isImporting}
                >
                  <Info className="w-4 h-4" />
                  View Schema
                </button>
                <button
                  onClick={handleClose}
                  disabled={isImporting}
                  className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Close"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Import records into collection &quot;<span className="font-medium text-slate-800">{collectionName}</span>&quot;
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  JSON Content
                </label>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
              </div>
              <textarea
                value={jsonContent}
                onChange={(e) => !isImporting && setJsonContent(e.target.value)}
                disabled={isImporting}
                placeholder='[{"field": "value"}, ...]&#10;&#10;Or click "Choose File" to upload a JSON file'
                className={`w-full h-64 px-3 py-2 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${
                  validationError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-slate-300 focus:ring-blue-500"
                } ${isImporting ? "opacity-50 cursor-not-allowed" : ""}`}
              />
              {validationError && (
                <p className="mt-2 text-sm text-red-600 flex items-start gap-1.5">
                  <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {validationError.message}
                    {validationError.line && (
                      <span className="ml-2 text-red-500">(around line {validationError.line})</span>
                    )}
                  </span>
                </p>
              )}
            </div>

            {isValid && parsedData && (
              <>
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="font-medium">
                      Ready to import: {parsedData.length} record{parsedData.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  
                  {schemaWarnings.length > 0 && (
                    <div className="space-y-1">
                      {schemaWarnings.map((warning, index) => (
                        <div key={index} className="flex items-start gap-1.5 text-sm text-amber-700">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{warning.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isImporting && (
                  <div>
                    <div className="flex items-center justify-between text-sm text-slate-700 mb-2">
                      <span>Importing records...</span>
                      <span className="font-medium">
                        {progress.current} / {progress.total}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {result && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-slate-700 mb-3">Import Results</h4>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {result.success} successful
                      </span>
                      {result.failed > 0 && (
                        <span className="text-red-600 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          {result.failed} failed
                        </span>
                      )}
                    </div>
                    {result.failed > 0 && (
                      <button
                        onClick={() => {
                          console.log('[ImportJsonDialog] View Failed Records clicked, showing modal');
                          setShowFailedRecords(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        View Failed Records
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
            <button
              onClick={handleClose}
              disabled={isImporting}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!canImport || isImporting}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Import Records
            </button>
          </div>
        </div>
      </div>

      {showSchemaInfo && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800">
                  Collection Schema: &quot;{collectionName}&quot;
                </h3>
                <button
                  onClick={() => setShowSchemaInfo(false)}
                  className="p-1 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {collectionSchema.length === 0 ? (
                  <p className="text-sm text-slate-500">No fields defined in this collection</p>
                ) : (
                  collectionSchema.map((field) => (
                    <div
                      key={field.name}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        field.system
                          ? "bg-slate-50 border-slate-200"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {field.system ? (
                          <Info className="w-4 h-4 text-slate-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        <div>
                          <span className="text-sm font-medium text-slate-700">{field.name}</span>
                          <span className="ml-2 text-xs text-slate-500">({field.type})</span>
                        </div>
                      </div>
                      {field.system && (
                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                          system
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Tip:</strong> Only non-system fields (marked with green check) should be included in your JSON. System fields (id, created, updated, etc.) are automatically managed by PocketBase.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFailedRecords && result && result.failed > 0 && (
        <>
          {console.log('[ImportJsonDialog] Failed Records modal is rendering')}
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <h3 className="text-lg font-semibold text-slate-800">
                      Failed Records ({result.failed})
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowFailedRecords(false)}
                    className="p-1 hover:bg-slate-100 rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {result.errors.map((error, index) => (
                  <div key={index} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">
                          Record #{error.index}
                        </p>
                        <p className="text-sm text-red-700 mt-1">
                          {error.error}
                        </p>
                      </div>
                    </div>
                    <div className="ml-7 mt-3">
                      <p className="text-xs text-slate-600 mb-1">Data:</p>
                      <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto">
                        {JSON.stringify(error.record, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end flex-shrink-0">
                <button
                  onClick={() => setShowFailedRecords(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
