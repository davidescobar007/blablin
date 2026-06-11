import { Eye, PencilLine, Table2 } from "lucide-react";
import { cn } from "../../lib/utils";

export type TableMode = "browse" | "individual" | "bulk";

interface ModeSwitcherProps {
  mode: TableMode;
  onChange: (mode: TableMode) => void;
  disabled?: boolean;
  hideBulk?: boolean;
}

const MODES: { value: TableMode; label: string; icon: typeof Eye }[] = [
  { value: "browse", label: "Browse", icon: Eye },
  { value: "individual", label: "Edit", icon: PencilLine },
  { value: "bulk", label: "Bulk", icon: Table2 },
];

export function ModeSwitcher({ mode, onChange, disabled, hideBulk }: ModeSwitcherProps) {
  const visibleModes = MODES.filter((m) => !(hideBulk && m.value === "bulk"));

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
      role="tablist"
      aria-label="View mode"
    >
      {visibleModes.map((m) => {
        const Icon = m.icon;
        const active = mode === m.value;
        return (
          <button
            key={m.value}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              active
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
