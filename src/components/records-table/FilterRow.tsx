import { useState } from "react";
import { X } from "lucide-react";
import type { Column } from "./types";
import type { ColumnFilter } from "./filter-types";
import { FilterOperator } from "./filter-types";
import { getOperatorsForType } from "./filter-utils";
import { TextInput, NumberInput, DateInput } from "../molecules/CellInput";

interface FilterRowProps {
  column: Column;
  filter: ColumnFilter | null;
  onFilterChange: (filter: ColumnFilter | null) => void;
  relationOptions?: Record<string, { id: string; [key: string]: unknown }[]>;
}

export function FilterRow({ column, filter, onFilterChange, relationOptions }: FilterRowProps) {
  const [localValue, setLocalValue] = useState(filter?.value || "");
  const [localValueTo, setLocalValueTo] = useState(filter?.valueTo || "");
  const [localOperator, setLocalOperator] = useState<FilterOperator>(
    filter?.operator || getOperatorsForType(column.type)[0],
  );

  const handleValueChange = (value: string) => {
    setLocalValue(value);
    if (value) {
      onFilterChange({
        columnKey: column.key,
        operator: localOperator,
        value,
        valueTo: localValueTo || undefined,
      });
    } else {
      onFilterChange(null);
    }
  };

  const handleValueToChange = (value: string) => {
    setLocalValueTo(value);
    onFilterChange({
      columnKey: column.key,
      operator: localOperator,
      value: localValue,
      valueTo: value || undefined,
    });
  };

  const handleOperatorChange = (operator: FilterOperator) => {
    setLocalOperator(operator);
    if (localValue) {
      onFilterChange({
        columnKey: column.key,
        operator,
        value: localValue,
        valueTo: localValueTo || undefined,
      });
    }
  };

  const renderValueInput = () => {
    const isSelectOrRelation = column.type === "select" || column.type === "relation";
    const options = column.type === "select" ? column.options?.values : undefined;
    const relationOpts = column.type === "relation" ? relationOptions?.[column.collectionId || ""] : undefined;

    if (isSelectOrRelation) {
      if (column.type === "relation" && relationOpts) {
        const getPresentableValue = (opt: { id: string; [key: string]: unknown }): string => {
          const presentableFields = ['name', 'title', 'label', 'username', 'email', 'displayName', 'fullName'];

          for (const field of presentableFields) {
            if (field in opt && opt[field]) {
              return String(opt[field]);
            }
          }

          return String(opt.id);
        };

        return (
          <select
            value={String(localValue)}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select value...</option>
            {relationOpts.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {getPresentableValue(opt)}
              </option>
            ))}
          </select>
        );
      }

      if (column.type === "select" && options) {
        return (
          <select
            value={String(localValue)}
            onChange={(e) => handleValueChange(e.target.value)}
            className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select value...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }
    }

    if (column.type === "number") {
      return (
        <NumberInput
          value={String(localValue)}
          onChange={handleValueChange}
          placeholder="Enter value"
        />
      );
    }

    if (column.type === "date") {
      return (
        <DateInput
          value={String(localValue)}
          onChange={handleValueChange}
          includeTime={column.options?.includeTime}
        />
      );
    }

    return (
      <TextInput
        value={String(localValue)}
        onChange={handleValueChange}
        placeholder="Enter value"
      />
    );
  };

  const showSecondInput = localOperator === FilterOperator.BETWEEN;

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-700">{column.name}</span>
        {filter && (
          <button
            onClick={() => {
              onFilterChange(null);
              setLocalValue("");
              setLocalValueTo("");
            }}
            className="p-1 hover:bg-red-100 rounded transition-colors text-red-500"
            title="Remove filter"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-2">
        <select
          value={localOperator}
          onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
          className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {getOperatorsForType(column.type).map((op) => (
            <option key={op} value={op}>
              {getOperatorLabel(op)}
            </option>
          ))}
        </select>

        {renderValueInput()}
      </div>

      {showSecondInput && (
        <div className="grid grid-cols-[140px_1fr] gap-2">
          <div className="text-xs text-slate-500 flex items-center">
            To
          </div>
          {column.type === "number" ? (
            <NumberInput
              value={String(localValueTo)}
              onChange={handleValueToChange}
              placeholder="Enter value"
            />
          ) : (
            <DateInput
              value={String(localValueTo)}
              onChange={handleValueToChange}
              includeTime={column.options?.includeTime}
            />
          )}
        </div>
      )}
    </div>
  );
}

function getOperatorLabel(operator: FilterOperator): string {
  const labels: Record<FilterOperator, string> = {
    [FilterOperator.CONTAINS]: "Contains",
    [FilterOperator.NOT_CONTAINS]: "Not contains",
    [FilterOperator.STARTS_WITH]: "Starts with",
    [FilterOperator.ENDS_WITH]: "Ends with",
    [FilterOperator.EQUALS]: "Equals",
    [FilterOperator.NOT_EQUALS]: "Not equals",
    [FilterOperator.GREATER_THAN]: "Greater than",
    [FilterOperator.LESS_THAN]: "Less than",
    [FilterOperator.GREATER_EQUAL]: "Greater or equal",
    [FilterOperator.LESS_EQUAL]: "Less or equal",
    [FilterOperator.BEFORE]: "Before",
    [FilterOperator.AFTER]: "After",
    [FilterOperator.BETWEEN]: "Between",
    [FilterOperator.IN]: "In",
    [FilterOperator.NOT_IN]: "Not in",
  };
  return labels[operator] || operator;
}
