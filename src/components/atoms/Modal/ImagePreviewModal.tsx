import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Modal } from ".";
import { cn } from "../../../lib/utils";
import { formatFileSize, convertToWebP } from "../../../utils";
import { compressImageIfNeeded } from "../../../utils/imageCompression";
import type { CompressionResult } from "../../../utils/imageCompression";

export interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  fileName?: string;
  fileSize?: number;
  originalFileSize?: number | null;
  wasCompressed?: boolean;
  fileObject?: File;
  onCompress?: (compressedFile: File) => void;
  defaultQuality?: number;
  canConvertToWebP?: boolean;
  onConvertToWebP?: (webPFile: File) => void;
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  fileName,
  fileSize,
  originalFileSize,
  wasCompressed,
  fileObject,
  onCompress,
  defaultQuality,
  canConvertToWebP,
  onConvertToWebP,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(
    defaultQuality || 0.7,
  );
  const [compressionResult, setCompressionResult] =
    useState<CompressionResult | null>(null);
  const [compressedImageUrl, setCompressedImageUrl] = useState<string | null>(null);
  const [isConvertingToWebP, setIsConvertingToWebP] = useState(false);
  const [webPConversionQuality, setWebPConversionQuality] = useState(0.9);
  const [isWebP, setIsWebP] = useState(false);
  const [webPImageUrl, setWebPImageUrl] = useState<string | null>(null);
  const [webPConvertedSize, setWebPConvertedSize] = useState<number | null>(null);

  const MAX_FILE_SIZE = 500000; // 500KB in bytes
  const exceedsLimit = fileSize && fileSize > MAX_FILE_SIZE;
  const formattedSize = fileSize ? formatFileSize(fileSize) : null;
  const formattedOriginalSize = originalFileSize
    ? formatFileSize(originalFileSize)
    : null;
  const compressionReduction =
    wasCompressed && originalFileSize && fileSize
      ? ((1 - fileSize / originalFileSize) * 100).toFixed(1)
      : null;

  const handleCompressImage = async () => {
    if (!fileObject) return;

    setIsCompressing(true);
    setCompressionResult(null);

    try {
      const result = await compressImageIfNeeded(
        fileObject,
        MAX_FILE_SIZE,
        compressionQuality,
        true, // force: user explicitly asked to compress, even if already small
      );

      if (result) {
        setCompressionResult(result);
        const newUrl = URL.createObjectURL(result.file);
        setCompressedImageUrl(newUrl);

        onCompress?.(result.file);
      }
    } catch (error) {
      console.error("[Modal] Compression error:", error);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleConvertToWebP = async () => {
    if (!fileObject) return;

    setIsConvertingToWebP(true);

    try {
      const webPFile = await convertToWebP(
        fileObject,
        webPConversionQuality
      );

      const url = URL.createObjectURL(webPFile);
      setWebPImageUrl(url);
      setIsWebP(true);
      setWebPConvertedSize(webPFile.size);

      onConvertToWebP?.(webPFile);
    } catch (error) {
      console.error("[Modal] WebP conversion error:", error);
    } finally {
      setIsConvertingToWebP(false);
    }
  };

  useEffect(() => {
    return () => {
      if (compressedImageUrl) {
        URL.revokeObjectURL(compressedImageUrl);
      }
      if (webPImageUrl) {
        URL.revokeObjectURL(webPImageUrl);
      }
    };
  }, [compressedImageUrl, webPImageUrl]);

  useEffect(() => {
    if (fileName) {
      const webP = fileName.toLowerCase().endsWith('.webp');
      setIsWebP(webP);
    }
  }, [fileName]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = () => {
    if (!imageUrl) return;

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName || `generated_image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" showCloseButton={false}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800">
              Image Preview
            </h3>
            {formattedSize && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                  compressionResult
                    ? compressionResult.compressedSize > MAX_FILE_SIZE
                      ? "bg-orange-50 text-orange-700 border border-orange-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                    : exceedsLimit
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : wasCompressed
                        ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                        : "bg-green-50 text-green-700 border border-green-200"
                )}
              >
                {compressionResult && <CheckCircle className="w-3.5 h-3.5" />}
                {exceedsLimit && !compressionResult && (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {wasCompressed && !compressionResult && !exceedsLimit && "✓ "}
                {compressionResult
                  ? formatFileSize(compressionResult.compressedSize)
                  : formattedSize}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {wasCompressed && compressionReduction && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-blue-800">
                Compressed:
              </span>
              <span className="text-xs text-blue-700">
                {formattedOriginalSize} → {formattedSize}
              </span>
            </div>
            <span className="text-xs font-bold text-blue-600">
              -{compressionReduction}%
            </span>
          </div>
        )}

        {compressionResult && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-green-800">
                  Image compressed successfully!
                </p>
                <div className="flex items-center justify-between text-xs text-green-700">
                  <span>
                    {formatFileSize(compressionResult.originalSize)} →{" "}
                    {formatFileSize(compressionResult.compressedSize)}
                  </span>
                  <span className="font-bold">
                    -{((1 - compressionResult.compressedSize / compressionResult.originalSize) * 100).toFixed(1)}%
                  </span>
                </div>
                {compressionResult.compressedSize > MAX_FILE_SIZE && (
                  <p className="text-xs text-yellow-700">
                    The image still exceeds the limit. Try a lower
                    quality.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {fileObject && !compressionResult && (
          <div
            className={cn(
              "mb-4 p-4 rounded-lg border",
              exceedsLimit
                ? "bg-orange-50 border-orange-200"
                : "bg-slate-50 border-slate-200"
            )}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                {exceedsLimit ? (
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {exceedsLimit
                      ? "The file exceeds the 500 KB limit"
                      : "Optimize your image size"}
                  </p>
                  <p className="text-xs mt-1">
                    {exceedsLimit
                      ? "You can compress the image to reduce its size."
                      : `Currently ${formattedSize}. Compress to save space.`}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Compression quality
                  </label>
                  <span className="text-sm text-slate-600 font-mono">
                    {Math.round(compressionQuality * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={compressionQuality}
                  onChange={(e) =>
                    setCompressionQuality(parseFloat(e.target.value))
                  }
                  disabled={isCompressing}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />

                <button
                  onClick={handleCompressImage}
                  disabled={isCompressing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {exceedsLimit
                        ? "Compress image"
                        : "Compress to optimize"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {canConvertToWebP &&
          !isWebP &&
          fileObject &&
          !webPImageUrl && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Zap className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-800">
                      Convert to WebP
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      WebP reduces size ~25-30% while keeping visual
                      quality.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">
                      WebP quality
                    </label>
                    <span className="text-sm text-slate-600 font-mono">
                      {Math.round(webPConversionQuality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.1"
                    value={webPConversionQuality}
                    onChange={(e) =>
                      setWebPConversionQuality(parseFloat(e.target.value))
                    }
                    disabled={isConvertingToWebP}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />

                  <button
                    onClick={handleConvertToWebP}
                    disabled={isConvertingToWebP}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConvertingToWebP ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Convert to WebP (~-30% size)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        {webPImageUrl && webPConvertedSize && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-green-800">
                  Converted to WebP successfully!
                </p>
                <div className="flex items-center justify-between text-xs text-green-700">
                  <span>
                    {formattedSize} → {formatFileSize(webPConvertedSize)}
                  </span>
                  <span className="font-bold">
                    -{(
                      (1 - webPConvertedSize / (fileSize || 1)) * 100
                    ).toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-green-600">
                  Format: <strong>WebP</strong> | New size:{" "}
                  <strong>{formatFileSize(webPConvertedSize)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center relative">
          <div
            className={cn(
              "transition-transform duration-200 ease-in-out",
              zoom !== 1 || rotation !== 0 ? "cursor-move" : "cursor-default"
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={webPImageUrl || compressedImageUrl || imageUrl}
              alt="Generated image preview"
              className="max-w-full max-h-[60vh] object-contain"
              draggable={false}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm text-slate-600 min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-slate-100 rounded transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 hover:bg-slate-100 rounded transition-colors ml-2"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4 text-slate-600" />
            </button>
            {(zoom !== 1 || rotation !== 0) && (
              <button
                onClick={handleReset}
                className="px-3 py-1 text-sm hover:bg-slate-100 rounded transition-colors ml-2"
                title="Reset view"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
