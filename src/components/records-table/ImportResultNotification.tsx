import { X, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

interface ImportResultNotificationProps {
  success: number;
  failed: number;
  onViewErrors?: () => void;
  onDismiss: () => void;
}

export function ImportResultNotification({
  success,
  failed,
  onViewErrors,
  onDismiss,
}: ImportResultNotificationProps) {
  return (
    <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 border border-slate-200 max-w-md z-50 animate-in slide-in-from-right-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-medium text-slate-800 mb-2">
            Import completed
          </p>
          <div className="flex gap-3 text-sm">
            <span className="text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {success} successful
            </span>
            {failed > 0 && (
              <span className="text-red-600 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                {failed} failed
              </span>
            )}
          </div>
          {failed > 0 && onViewErrors && (
            <button
              onClick={onViewErrors}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View failed records
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </div>
  );
}
