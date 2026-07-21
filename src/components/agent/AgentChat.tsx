import { useRef, useEffect, useState } from "react";
import { MessageSquare, X, Send, Loader2, Paperclip, FileText, Image, File as FileIcon, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { AgentMessageItem } from "./AgentMessage";
import type { AgentAttachment, AgentMessage } from "../../agent/agent.types";
import { processFiles, MAX_ATTACHMENTS, MAX_ATTACHMENT_SIZE_MB } from "../../agent/file-reader";
import { GEMINI_MODELS } from "../../constants/ai.models";
import type { GeminiModelId } from "../../constants/ai.models";

interface AgentChatProps {
  messages: AgentMessage[];
  isLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (text: string, attachments: AgentAttachment[]) => void;
  selectedModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
}

export function AgentChat({ messages, isLoading, isOpen, onOpenChange, onSend, selectedModel, onModelChange }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading || isProcessingFiles) return;
    setInput("");
    setErrors([]);
    const attachmentsToSend = attachments;
    setAttachments([]);
    onSend(text, attachmentsToSend);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrors([]);

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setErrors([`Máximo ${MAX_ATTACHMENTS} archivos permitidos.`]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsProcessingFiles(true);
    try {
      const result = await processFiles(files);
      setAttachments((prev) => [...prev, ...result.attachments]);
      if (result.errors.length > 0) {
        setErrors(result.errors.map((err) => err.message));
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Error procesando archivos"]);
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const getAttachmentIcon = (contentType: AgentAttachment["contentType"]) => {
    switch (contentType) {
      case "image":
        return <Image className="w-3.5 h-3.5" />;
      case "pdf":
        return <FileIcon className="w-3.5 h-3.5" />;
      case "text":
        return <FileText className="w-3.5 h-3.5" />;
      default:
        return <FileIcon className="w-3.5 h-3.5" />;
    }
  };

  const canSubmit = (input.trim() || attachments.length > 0) && !isLoading && !isProcessingFiles;

  return (
    <>
      <button
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105",
          isOpen ? "bg-slate-800 text-white" : "bg-blue-600 text-white",
        )}
        aria-label={isOpen ? "Cerrar agente" : "Abrir agente"}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm truncate">Agente PocketBase</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} disabled={isLoading} />
              <button onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 bg-slate-50">
            {messages.map((message, index) => (
              <AgentMessageItem key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pensando...</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-white border-t border-slate-200">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs border border-slate-200"
                    title={attachment.name}
                  >
                    {getAttachmentIcon(attachment.contentType)}
                    <span className="max-w-[120px] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="ml-1 text-slate-500 hover:text-red-600"
                      aria-label={`Eliminar ${attachment.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.length > 0 && (
              <div className="mb-2 space-y-1">
                {errors.map((err, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Adjuntar archivos"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isProcessingFiles || attachments.length >= MAX_ATTACHMENTS}
                className="px-2 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={`Adjuntar archivo (máx. ${MAX_ATTACHMENTS}, ${MAX_ATTACHMENT_SIZE_MB} MB c/u)`}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pídeme algo..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
            <div className="mt-1 text-[10px] text-slate-400 text-right">
              Máx. {MAX_ATTACHMENTS} archivos · {MAX_ATTACHMENT_SIZE_MB} MB c/u
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ModelSelectorProps {
  selectedModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  disabled?: boolean;
}

function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = GEMINI_MODELS.find((m) => m.id === selectedModel && m.type === "text");
  const label = current?.name ?? selectedModel;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Cambiar modelo del agente"
      >
        <span className="max-w-[110px] truncate">{label}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden">
          {GEMINI_MODELS.filter((m) => m.type === "text").map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onModelChange(m.id as GeminiModelId);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-xs hover:bg-slate-100 flex flex-col gap-0.5",
                m.id === selectedModel && "bg-blue-50",
              )}
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-[10px] text-slate-500">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

