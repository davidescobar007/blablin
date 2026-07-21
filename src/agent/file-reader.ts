import type { AgentAttachment, AttachmentContentType } from "./agent.types";

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_SIZE_MB = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

export interface FileValidationError {
  fileName: string;
  reason: "too-large" | "unsupported" | "read-error";
  message: string;
}

export interface ProcessFilesResult {
  attachments: AgentAttachment[];
  errors: FileValidationError[];
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:*/*;base64, prefix
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function getContentType(mimeType: string, fileName: string): AttachmentContentType {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (lowerMime.startsWith("image/")) return "image";
  if (lowerMime === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (
    lowerMime.startsWith("text/") ||
    lowerMime === "application/json" ||
    lowerMime === "application/javascript" ||
    lowerMime === "application/typescript" ||
    lowerMime === "application/xml" ||
    lowerMime === "application/csv" ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".js") ||
    lowerName.endsWith(".ts") ||
    lowerName.endsWith(".tsx") ||
    lowerName.endsWith(".jsx") ||
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".css") ||
    lowerName.endsWith(".yaml") ||
    lowerName.endsWith(".yml")
  ) {
    return "text";
  }
  if (
    lowerMime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerMime === "application/vnd.ms-excel" ||
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls")
  ) {
    return "text";
  }
  return "unsupported";
}

async function loadXlsx(): Promise<typeof import("xlsx")> {
  const module = await import("xlsx");
  if ("read" in module && typeof module.read === "function") {
    return module as typeof import("xlsx");
  }
  const withDefault = module as { default?: typeof import("xlsx") };
  if (withDefault.default && "read" in withDefault.default) {
    return withDefault.default;
  }
  throw new Error("xlsx module not loaded correctly");
}

async function readExcelAsText(file: File): Promise<string> {
  const XLSX = await loadXlsx();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const parts: string[] = [
          `Archivo Excel: ${file.name}`,
          `Total de pestañas: ${workbook.SheetNames.length}`,
          `Pestañas: ${workbook.SheetNames.join(", ")}`,
          "",
        ];

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
          if (json.length === 0) {
            parts.push(`--- Pestaña: "${sheetName}" (vacía) ---`);
            return;
          }

          const headers = json[0].map((h) => (h === null || h === undefined ? "" : String(h)));
          parts.push(`--- Pestaña: "${sheetName}" ---`);
          parts.push(`Encabezados: ${JSON.stringify(headers)}`);
          parts.push(`Filas de datos: ${json.length - 1}`);
          parts.push("Datos:");

          for (let i = 1; i < json.length; i++) {
            const row = json[i];
            const obj: Record<string, unknown> = {};
            headers.forEach((header, idx) => {
              if (header) {
                obj[header] = row[idx];
              }
            });
            parts.push(`[${i}] ${JSON.stringify(obj)}`);
          }

          parts.push("");
        });

        resolve(parts.join("\n"));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to read Excel file"));
      }
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

async function processFile(file: File): Promise<{
  attachment: AgentAttachment | null;
  error: FileValidationError | null;
}> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      attachment: null,
      error: {
        fileName: file.name,
        reason: "too-large",
        message: `${file.name} excede el límite de ${MAX_ATTACHMENT_SIZE_MB} MB`,
      },
    };
  }

  const contentType = getContentType(file.type || "", file.name);

  if (contentType === "unsupported") {
    return {
      attachment: null,
      error: {
        fileName: file.name,
        reason: "unsupported",
        message: `${file.name} tiene un formato no soportado`,
      },
    };
  }

  try {
    const base: Omit<AgentAttachment, "textContent" | "base64Content"> = {
      id: generateId(),
      name: file.name,
      mimeType: file.type || getFallbackMimeType(file.name, contentType),
      size: file.size,
      contentType,
    };

    if (contentType === "text") {
      const isExcel =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel";

      const textContent = isExcel ? await readExcelAsText(file) : await readFileAsText(file);

      return {
        attachment: { ...base, textContent },
        error: null,
      };
    }

    // image or pdf -> base64
    const base64Content = await readFileAsBase64(file);
    return {
      attachment: { ...base, base64Content },
      error: null,
    };
  } catch (error) {
    return {
      attachment: null,
      error: {
        fileName: file.name,
        reason: "read-error",
        message: error instanceof Error ? error.message : `Error leyendo ${file.name}`,
      },
    };
  }
}

function getFallbackMimeType(fileName: string, contentType: AttachmentContentType): string {
  const lowerName = fileName.toLowerCase();
  if (contentType === "pdf" || lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".json")) return "application/json";
  if (lowerName.endsWith(".csv")) return "text/csv";
  if (lowerName.endsWith(".md")) return "text/markdown";
  if (lowerName.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lowerName.endsWith(".xls")) return "application/vnd.ms-excel";
  if (contentType === "image") return "image/png";
  return "text/plain";
}

export async function processFiles(files: FileList | File[] | null): Promise<ProcessFilesResult> {
  if (!files) return { attachments: [], errors: [] };

  const fileArray = Array.from(files);
  const result: ProcessFilesResult = { attachments: [], errors: [] };

  for (const file of fileArray) {
    const { attachment, error } = await processFile(file);
    if (attachment) result.attachments.push(attachment);
    if (error) result.errors.push(error);
  }

  return result;
}
