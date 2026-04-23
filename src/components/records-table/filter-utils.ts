import type { TrackedRecord } from "../../context/PocketBaseContext";
import type { Column } from "./types";
import { FilterOperator } from "./filter-types";

export function getOperatorsForType(columnType: string): FilterOperator[] {
  switch (columnType) {
    case "text":
    case "email":
    case "url":
      return [
        FilterOperator.CONTAINS,
        FilterOperator.NOT_CONTAINS,
        FilterOperator.STARTS_WITH,
        FilterOperator.ENDS_WITH,
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
      ];
    case "number":
      return [
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
        FilterOperator.GREATER_THAN,
        FilterOperator.LESS_THAN,
        FilterOperator.GREATER_EQUAL,
        FilterOperator.LESS_EQUAL,
      ];
    case "date":
      return [
        FilterOperator.EQUALS,
        FilterOperator.BEFORE,
        FilterOperator.AFTER,
        FilterOperator.BETWEEN,
      ];
    case "select":
      return [
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
      ];
    case "relation":
      return [
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
      ];
    default:
      return [
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
      ];
  }
}

export function applyTextFilter(
  value: unknown,
  operator: FilterOperator,
  filterValue: unknown,
): boolean {
  const strValue = String(value || "").toLowerCase();
  const strFilter = String(filterValue || "").toLowerCase();

  switch (operator) {
    case FilterOperator.CONTAINS:
      return strValue.includes(strFilter);
    case FilterOperator.NOT_CONTAINS:
      return !strValue.includes(strFilter);
    case FilterOperator.STARTS_WITH:
      return strValue.startsWith(strFilter);
    case FilterOperator.ENDS_WITH:
      return strValue.endsWith(strFilter);
    case FilterOperator.EQUALS:
      return strValue === strFilter;
    case FilterOperator.NOT_EQUALS:
      return strValue !== strFilter;
    default:
      return false;
  }
}

export function applyNumberFilter(
  value: unknown,
  operator: FilterOperator,
  filterValue: unknown,
): boolean {
  const numValue = Number(value);
  const numFilter = Number(filterValue);

  if (isNaN(numValue) || isNaN(numFilter)) return false;

  switch (operator) {
    case FilterOperator.EQUALS:
      return numValue === numFilter;
    case FilterOperator.NOT_EQUALS:
      return numValue !== numFilter;
    case FilterOperator.GREATER_THAN:
      return numValue > numFilter;
    case FilterOperator.LESS_THAN:
      return numValue < numFilter;
    case FilterOperator.GREATER_EQUAL:
      return numValue >= numFilter;
    case FilterOperator.LESS_EQUAL:
      return numValue <= numFilter;
    default:
      return false;
  }
}

export function applyDateFilter(
  value: unknown,
  operator: FilterOperator,
  filterValue: unknown,
  filterValueTo?: unknown,
): boolean {
  const dateValue = new Date(value as string);
  const dateFilter = new Date(filterValue as string);
  const dateFilterTo = filterValueTo ? new Date(filterValueTo as string) : null;

  if (isNaN(dateValue.getTime()) || isNaN(dateFilter.getTime())) return false;

  switch (operator) {
    case FilterOperator.EQUALS:
      return (
        dateValue.toDateString() === dateFilter.toDateString()
      );
    case FilterOperator.BEFORE:
      return dateValue < dateFilter;
    case FilterOperator.AFTER:
      return dateValue > dateFilter;
    case FilterOperator.BETWEEN:
      if (!dateFilterTo || isNaN(dateFilterTo.getTime())) return false;
      return dateValue >= dateFilter && dateValue <= dateFilterTo;
    default:
      return false;
  }
}

export function applySelectFilter(
  value: unknown,
  operator: FilterOperator,
  filterValue: unknown,
): boolean {
  const strValue = String(value || "");
  const strFilter = String(filterValue || "");

  switch (operator) {
    case FilterOperator.EQUALS:
      return strValue === strFilter;
    case FilterOperator.NOT_EQUALS:
      return strValue !== strFilter;
    default:
      return false;
  }
}

export function applyRelationFilter(
  value: unknown,
  operator: FilterOperator,
  filterValue: unknown,
): boolean {
  const strValue = String(value || "");
  const strFilter = String(filterValue || "");

  switch (operator) {
    case FilterOperator.EQUALS:
      return strValue === strFilter;
    case FilterOperator.NOT_EQUALS:
      return strValue !== strFilter;
    default:
      return false;
  }
}

export function applyColumnFilter(
  record: TrackedRecord,
  columnKey: string,
  operator: FilterOperator,
  filterValue: unknown,
  filterValueTo?: unknown,
  columnType?: string,
): boolean {
  const value = record.data[columnKey];

  if (columnType === "text" || columnType === "email" || columnType === "url") {
    return applyTextFilter(value, operator, filterValue);
  }

  if (columnType === "number") {
    return applyNumberFilter(value, operator, filterValue);
  }

  if (columnType === "date") {
    return applyDateFilter(value, operator, filterValue, filterValueTo);
  }

  if (columnType === "select") {
    return applySelectFilter(value, operator, filterValue);
  }

  if (columnType === "relation") {
    return applyRelationFilter(value, operator, filterValue);
  }

  return applyTextFilter(value, operator, filterValue);
}

export function applyGlobalSearch(
  record: TrackedRecord,
  searchTerm: string,
  columns: Column[],
): boolean {
  if (!searchTerm.trim()) return true;

  const term = searchTerm.toLowerCase();

  return columns.some((column) => {
    const value = record.data[column.key];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(term);
  });
}
