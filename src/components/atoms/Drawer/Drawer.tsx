import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  position?: "left" | "right";
  width?: string;
  fullScreenOnMobile?: boolean;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  width = "400px",
  fullScreenOnMobile = false,
}: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const style = fullScreenOnMobile
    ? ({ "--drawer-width": width } as React.CSSProperties)
    : { width };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 bottom-0 z-50 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
          position === "left" ? "left-0" : "right-0",
          fullScreenOnMobile && "w-full md:w-[var(--drawer-width)]",
        )}
        style={style}
      >
        <div className="h-full flex flex-col">
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          )}
          {!title && (
            <div className="flex justify-end px-6 py-4 border-b border-slate-200">
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </>
  );
}
