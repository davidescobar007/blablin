import { Bot, User, Wrench, FileText, Image, File as FileIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";
import type { AgentAttachment, AgentMessage } from "../../agent/agent.types";

interface AgentMessageItemProps {
  message: AgentMessage;
}

export function AgentMessageItem({ message }: AgentMessageItemProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  return (
    <div className={cn("flex gap-3 mb-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-blue-600 text-white" : isTool ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-700",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : isTool ? <Wrench className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] min-w-0 rounded-2xl px-4 py-2 text-sm",
          isUser
            ? "bg-blue-600 text-white rounded-br-none"
            : isTool
              ? "bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-none"
              : "bg-slate-100 text-slate-800 rounded-bl-none",
        )}
      >
        {isTool && message.toolName && <div className="text-xs font-semibold mb-1 opacity-70">🛠️ {message.toolName}</div>}

        {isTool || isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}

        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.attachments.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} isUser={isUser} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentChip({ attachment, isUser }: { attachment: AgentAttachment; isUser: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium",
        isUser ? "bg-blue-500/30 text-white" : "bg-slate-200 text-slate-700",
      )}
      title={attachment.name}
    >
      <AttachmentIcon contentType={attachment.contentType} />
      <span className="max-w-[100px] truncate">{attachment.name}</span>
    </div>
  );
}

function AttachmentIcon({ contentType }: { contentType: AgentAttachment["contentType"] }) {
  switch (contentType) {
    case "image":
      return <Image className="w-3 h-3" />;
    case "text":
      return <FileText className="w-3 h-3" />;
    default:
      return <FileIcon className="w-3 h-3" />;
  }
}
