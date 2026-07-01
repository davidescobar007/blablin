import { useEffect, useCallback } from "react";
import { Drawer } from "../atoms/Drawer";
import type { TrackedRecord } from "../../types/pocketbase.types";
import type { Column } from "./types";
import { DetailPanel } from "./DetailPanel";

interface RowNavigatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  records: TrackedRecord[];
  columns: Column[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onUpdateCell: (rowId: string, field: string, value: unknown) => void;
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
}

export function RowNavigatorDrawer({
  isOpen,
  onClose,
  records,
  columns,
  currentIndex,
  onIndexChange,
  onUpdateCell,
  relationOptions,
}: RowNavigatorDrawerProps) {
  const currentRecord = records[currentIndex] || null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < records.length - 1) {
          onIndexChange(currentIndex + 1);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          onIndexChange(currentIndex - 1);
        }
      }
    },
    [isOpen, currentIndex, records.length, onIndexChange],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="900px"
      title="Row Navigator"
      fullScreenOnMobile
    >
      <DetailPanel
        record={currentRecord}
        columns={columns}
        relationOptions={relationOptions}
        onUpdateCell={onUpdateCell}
        onPrev={() => onIndexChange(currentIndex - 1)}
        onNext={() => onIndexChange(currentIndex + 1)}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < records.length - 1}
        position={currentIndex}
        total={records.length}
      />
    </Drawer>
  );
}
