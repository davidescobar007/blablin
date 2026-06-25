import { useCallback, useEffect, useState } from "react";
import type { TableMode } from "../ModeSwitcher";

const MODE_STORAGE_KEY = "records-table-mode";

function loadStoredMode(): TableMode {
  if (typeof window === "undefined") return "browse";
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === "browse" || stored === "individual" || stored === "bulk") {
    return stored;
  }
  return "browse";
}

export function useTableMode() {
  const [mode, setMode] = useState<TableMode>(loadStoredMode);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  const changeMode = useCallback((next: TableMode) => {
    setMode(next);
  }, []);

  return { mode, setMode: changeMode };
}
