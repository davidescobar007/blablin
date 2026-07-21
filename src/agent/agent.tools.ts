import type { AgentTool } from "./agent.types";

export interface AgentActions {
  getContext: () => string;
  addNewRows: (count: number) => Promise<string>;
  saveChanges: () => Promise<string>;
  discardChanges: () => string;
  refreshRecords: () => Promise<string>;
  clearFilters: () => string;
  setGlobalSearch: (query: string) => string;
  switchMode: (mode: string) => string;
  selectAllRows: () => string;
  clearSelection: () => string;
  fillWithAI: (columnNames: string[]) => Promise<string>;
  showAISettings: () => string;
  configureAIColumn: (columnName: string) => string;
  showImportDialog: () => string;
  showExportDialog: () => string;
  deleteSelected: () => Promise<string>;
  setColumnFilter: (columnKey: string, value: string) => string;
  getColumnValues: (columnName: string, filterColumn?: string, filterValue?: string, scope?: "all" | "selected") => Promise<string>;
  summarizeColumnValues: (columnName: string, filterColumn?: string, filterValue?: string, scope?: "all" | "selected") => Promise<string>;
  bulkCreateRecords: (records: Record<string, unknown>[], collectionName?: string) => Promise<string>;
  bulkUpdateRecords: (updates: { id: string; data: Record<string, unknown> }[], collectionName?: string) => Promise<string>;
  getRecords: (collectionName: string, filterColumn?: string, filterValue?: string, limit?: number) => Promise<string>;
}

export function buildTools(actions: AgentActions): AgentTool[] {
  return [
    {
      name: "get_current_context",
      description: "Devuelve el estado actual de la app: colección seleccionada, registros, cambios pendientes, filas seleccionadas, etc.",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.getContext(),
    },
    {
      name: "add_new_rows",
      description: "Añade N filas vacías a la colección actual",
      parameters: {
        type: "object",
        properties: {
          count: { type: "number", description: "Cantidad de filas a añadir (por defecto 1)" },
        },
        required: ["count"],
      },
      execute: async (args) => {
        const count = typeof args.count === "number" ? args.count : 1;
        return actions.addNewRows(Math.max(1, count));
      },
    },
    {
      name: "save_changes",
      description: "Guarda todos los cambios pendientes (creaciones y actualizaciones)",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.saveChanges(),
    },
    {
      name: "discard_changes",
      description: "Descarta todos los cambios no guardados",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.discardChanges(),
    },
    {
      name: "refresh_records",
      description: "Recarga los registros desde PocketBase",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.refreshRecords(),
    },
    {
      name: "clear_filters",
      description: "Limpia todos los filtros y búsqueda global",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.clearFilters(),
    },
    {
      name: "search_records",
      description: "Aplica una búsqueda global sobre los registros visibles",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar en todos los campos" },
        },
        required: ["query"],
      },
      execute: async (args) => actions.setGlobalSearch(String(args.query)),
    },
    {
      name: "filter_column",
      description: "Filtra registros por valor exacto en una columna",
      parameters: {
        type: "object",
        properties: {
          column: { type: "string", description: "Nombre de la columna" },
          value: { type: "string", description: "Valor que deben contener los registros" },
        },
        required: ["column", "value"],
      },
      execute: async (args) =>
        actions.setColumnFilter(String(args.column), String(args.value)),
    },
    {
      name: "switch_view_mode",
      description: "Cambia el modo de visualización de la tabla",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["browse", "individual", "bulk"], description: "Modo de visualización" },
        },
        required: ["mode"],
      },
      execute: async (args) => actions.switchMode(String(args.mode)),
    },
    {
      name: "select_all_rows",
      description: "Selecciona todas las filas filtradas",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.selectAllRows(),
    },
    {
      name: "clear_selection",
      description: "Deselecciona todas las filas",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.clearSelection(),
    },
    {
      name: "fill_with_ai",
      description: "Genera contenido con IA para las filas seleccionadas en las columnas indicadas. Requiere que haya filas seleccionadas y configuración AI para esas columnas.",
      parameters: {
        type: "object",
        properties: {
          columnNames: { type: "array", items: { type: "string" }, description: "Lista de nombres de columna a rellenar" },
        },
        required: ["columnNames"],
      },
      execute: async (args) =>
        actions.fillWithAI(Array.isArray(args.columnNames) ? args.columnNames : []),
    },
    {
      name: "show_ai_settings",
      description: "Abre el diálogo de configuración de la API key de Gemini",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.showAISettings(),
    },
    {
      name: "configure_ai_column",
      description: "Abre el diálogo para configurar la generación AI de una columna",
      parameters: {
        type: "object",
        properties: {
          columnName: { type: "string", description: "Nombre de la columna a configurar" },
        },
        required: ["columnName"],
      },
      execute: async (args) => actions.configureAIColumn(String(args.columnName)),
    },
    {
      name: "import_records",
      description: "Abre el diálogo para importar registros JSON",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.showImportDialog(),
    },
    {
      name: "export_records",
      description: "Abre el diálogo para exportar registros a Excel",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.showExportDialog(),
    },
    {
      name: "delete_selected_records",
      description: "Elimina los registros seleccionados actualmente",
      parameters: { type: "object", properties: {} },
      execute: async () => actions.deleteSelected(),
    },
    {
      name: "get_column_values",
      description: "Devuelve los valores de una columna para los registros filtrados o seleccionados. Útil para ver el contenido real de los registros.",
      parameters: {
        type: "object",
        properties: {
          columnName: { type: "string", description: "Nombre de la columna cuyos valores se quieren obtener" },
          filterColumn: { type: "string", description: "Opcional: columna para filtrar registros" },
          filterValue: { type: "string", description: "Opcional: valor que debe contener filterColumn" },
          scope: { type: "string", enum: ["all", "selected"], description: "Ámbito: all (todos los registros) o selected (solo seleccionados)" },
        },
        required: ["columnName"],
      },
      execute: async (args) =>
        actions.getColumnValues(
          String(args.columnName),
          args.filterColumn ? String(args.filterColumn) : undefined,
          args.filterValue ? String(args.filterValue) : undefined,
          args.scope ? (String(args.scope) as "all" | "selected") : undefined,
        ),
    },
    {
      name: "summarize_column_values",
      description: "Resume los valores de una columna para los registros filtrados o seleccionados usando IA. Útil para hacer resúmenes de contenido, descripciones, etc.",
      parameters: {
        type: "object",
        properties: {
          columnName: { type: "string", description: "Nombre de la columna a resumir" },
          filterColumn: { type: "string", description: "Opcional: columna para filtrar registros" },
          filterValue: { type: "string", description: "Opcional: valor que debe contener filterColumn" },
          scope: { type: "string", enum: ["all", "selected"], description: "Ámbito: all (todos los registros) o selected (solo seleccionados)" },
        },
        required: ["columnName"],
      },
      execute: async (args) =>
        actions.summarizeColumnValues(
          String(args.columnName),
          args.filterColumn ? String(args.filterColumn) : undefined,
          args.filterValue ? String(args.filterValue) : undefined,
          args.scope ? (String(args.scope) as "all" | "selected") : undefined,
        ),
    },
    {
      name: "bulk_create_records",
      description: "Crea múltiples registros en una colección a partir de un array de objetos. Si no se especifica collectionName, usa la colección actual. Útil para importar datos de archivos adjuntos (Excel, CSV, JSON) o para crear registros en colecciones relacionadas.",
      parameters: {
        type: "object",
        properties: {
          records: {
            type: "array",
            items: { type: "object", description: "Objeto con los campos del registro a crear" },
            description: "Lista de registros a crear",
          },
          collectionName: {
            type: "string",
            description: "Nombre de la colección donde crear los registros. Si se omite, usa la colección actual.",
          },
        },
        required: ["records"],
      },
      execute: async (args) =>
        actions.bulkCreateRecords(
          Array.isArray(args.records) ? (args.records as Record<string, unknown>[]) : [],
          args.collectionName ? String(args.collectionName) : undefined,
        ),
    },
    {
      name: "bulk_update_records",
      description: "Actualiza múltiples registros en una colección a partir de un array de {id, data}. Útil para actualizar en masa sin borrar y recrear. Si no se especifica collectionName, usa la colección actual.",
      parameters: {
        type: "object",
        properties: {
          updates: {
            type: "array",
            items: {
              type: "object",
              description: "Objeto con id del registro y data a actualizar",
              properties: {
                id: { type: "string", description: "ID del registro" },
                data: { type: "object", description: "Campos a actualizar" },
              },
              required: ["id", "data"],
            },
            description: "Lista de actualizaciones",
          },
          collectionName: {
            type: "string",
            description: "Nombre de la colección. Si se omite, usa la colección actual.",
          },
        },
        required: ["updates"],
      },
      execute: async (args) =>
        actions.bulkUpdateRecords(
          Array.isArray(args.updates) ? (args.updates as { id: string; data: Record<string, unknown> }[]) : [],
          args.collectionName ? String(args.collectionName) : undefined,
        ),
    },
    {
      name: "get_records",
      description: "Consulta registros de una colección (incluyendo sus IDs) para poder usarlos en importaciones multi-colección. Útil para obtener IDs de registros relacionados.",
      parameters: {
        type: "object",
        properties: {
          collectionName: {
            type: "string",
            description: "Nombre de la colección a consultar",
          },
          filterColumn: {
            type: "string",
            description: "Opcional: columna para filtrar registros",
          },
          filterValue: {
            type: "string",
            description: "Opcional: valor que debe contener filterColumn",
          },
          limit: {
            type: "number",
            description: "Máximo de registros a devolver (por defecto 500)",
          },
        },
        required: ["collectionName"],
      },
      execute: async (args) =>
        actions.getRecords(
          String(args.collectionName),
          args.filterColumn ? String(args.filterColumn) : undefined,
          args.filterValue ? String(args.filterValue) : undefined,
          typeof args.limit === "number" ? args.limit : undefined,
        ),
    },
  ];
}
