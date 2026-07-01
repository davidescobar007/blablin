import imageCompression from "browser-image-compression";
import { formatFileSize } from "./fileUtils";

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  quality: number;
  iterations: number;
}

const MAX_FILE_SIZE = 500000; // 500KB in bytes
const MIN_QUALITY = 0.3;
const MAX_ITERATIONS = 5;

export async function compressImageIfNeeded(
  file: File,
  maxSize: number = MAX_FILE_SIZE,
  initialQuality: number = 0.7,
  force: boolean = false,
): Promise<CompressionResult | null> {
  const originalSize = file.size;

  // Skip only when the file is already small AND the caller isn't explicitly
  // forcing a re-compression (e.g. the user clicked "compress" in the modal).
  if (!force && originalSize <= maxSize) {
    console.log("[Compression] File size is within limit:", formatFileSize(originalSize));
    return null;
  }

  console.log(
    "[Compression] File exceeds limit, compressing...",
    formatFileSize(originalSize),
    `> ${formatFileSize(maxSize)} limit`,
  );

  let currentQuality = initialQuality;
  let iterations = 0;
  let compressedFile: File | null = null;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    console.log(
      `[Compression] Iteration ${iterations}: Compressing with quality ${currentQuality}`,
    );

    try {
      const options = {
        maxSizeMB: maxSize / (1024 * 1024),
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        quality: currentQuality,
        initialQuality: currentQuality,
      };

      compressedFile = await imageCompression(file, options);

      console.log(
        `[Compression] Iteration ${iterations} result:`,
        formatFileSize(compressedFile.size),
      );

      if (compressedFile.size <= maxSize) {
        console.log(
          `[Compression] Compression successful after ${iterations} iteration(s)`,
        );
        break;
      }

      if (currentQuality > MIN_QUALITY) {
        currentQuality = Math.max(currentQuality - 0.1, MIN_QUALITY);
      } else {
        console.log(
          `[Compression] Reached minimum quality (${MIN_QUALITY}), stopping compression`,
        );
        break;
      }
    } catch (error) {
      console.error("[Compression] Error during compression:", error);
      throw error;
    }
  }

  if (!compressedFile) {
    throw new Error("Failed to compress image");
  }

  const isWebP =
    file.name.endsWith(".webp") || file.type === "image/webp";
  const extension = isWebP ? ".webp" : ".png";
  const fileType = isWebP ? "image/webp" : "image/png";

  const compressedFileWithExtension = new File(
    [compressedFile],
    `compressed_${Date.now()}${extension}`,
    { type: fileType }
  );

  const result: CompressionResult = {
    file: compressedFileWithExtension,
    originalSize,
    compressedSize: compressedFile.size,
    quality: currentQuality,
    iterations,
  };

  console.log("[Compression] Final result:", {
    original: formatFileSize(originalSize),
    compressed: formatFileSize(compressedFile.size),
    reduction: `${((1 - compressedFile.size / originalSize) * 100).toFixed(1)}%`,
    quality: currentQuality,
    withinLimit: compressedFile.size <= maxSize,
  });

  return result;
}
