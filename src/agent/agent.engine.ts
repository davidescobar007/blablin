import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import type { FunctionDeclaration, Schema, Part } from "@google/genai";
import type {
  AgentMessage,
  AgentTool,
  AgentEngineOptions,
  AgentToolParameter,
  AgentToolParameters,
  FunctionCallEntry,
} from "./agent.types";

function mapParameterType(type: string): Type {
  switch (type) {
    case "string":
      return Type.STRING;
    case "number":
      return Type.NUMBER;
    case "boolean":
      return Type.BOOLEAN;
    case "array":
      return Type.ARRAY;
    case "object":
      return Type.OBJECT;
    default:
      return Type.STRING;
  }
}

function convertParameter(param: AgentToolParameter): Schema {
  const schema: Schema = {
    type: mapParameterType(param.type),
    description: param.description,
    enum: param.enum,
  };
  if (param.items) {
    schema.items = convertParameter(param.items);
  }
  if (param.properties) {
    const properties: Record<string, Schema> = {};
    for (const [key, value] of Object.entries(param.properties)) {
      properties[key] = convertParameter(value);
    }
    schema.properties = properties;
    schema.required = param.required;
  }
  return schema;
}

function convertParameters(params: AgentToolParameters): Schema {
  const properties: Record<string, Schema> = {};
  for (const [key, value] of Object.entries(params.properties)) {
    properties[key] = convertParameter(value);
  }
  return {
    type: Type.OBJECT,
    properties,
    required: params.required,
  };
}

function convertToolsForGemini(tools: AgentTool[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertParameters(tool.parameters),
  }));
}

function buildSystemInstruction(contextText: string) {
  return [
    "Eres un asistente experto dentro de PocketBase Bulk Editor.",
    "Tienes acceso a herramientas que te permiten actuar sobre la app.",
    "Antes de ejecutar una acción destructiva (guardar, eliminar, descartar), confirma brevemente con el usuario.",
    "Si el usuario pide algo que requiere una herramienta, usa la herramienta.",
    "Si pide algo vago, pide aclaración.",
    "Puedes recibir archivos adjuntos (imágenes, PDFs, texto, CSV, Excel). Los archivos de texto, CSV y Excel se incluyen en el prompt como texto/JSON legible. Especialmente los archivos Excel se convierten a texto mostrando TODAS sus pestañas, encabezados y filas.",
    "Puedes ejecutar múltiples herramientas en secuencia automáticamente hasta completar la tarea. Si una herramienta devuelve datos que necesitas para el siguiente paso, continúa con el siguiente paso sin esperar confirmación del usuario. NO te detengas después de una sola herramienta si la tarea aún no está completa.",
    "Puedes consultar valores reales de columnas con get_column_values y resumir contenido de múltiples registros con summarize_column_values.",
    "Si el usuario quiere importar datos de un archivo adjunto (Excel, CSV, JSON) a la tabla: (1) analiza los datos del prompt, (2) identifica las pestañas/columnas disponibles, (3) confirma el mapeo de columnas si no está claro, (4) usa bulk_create_records para crear los registros. NUNCA digas que solo puedes importar JSON.",
    "Puedes crear registros en cualquier colección usando bulk_create_records con collectionName. Si necesitas IDs de otra colección (por ejemplo, crear learning_units y luego referenciar sus IDs en grammar), usa get_records para obtenerlos, y luego bulk_create_records con los IDs correctos.",
    "Si cometiste un error al crear registros (por ejemplo, olvidaste un campo como difficulty), NO sugieras borrar y recrear. Usa bulk_update_records para actualizar los registros existentes en masa.",
    "Responde en español o inglés según el idioma del usuario.",
    "Contexto actual de la app:",
    contextText,
  ].join("\n");
}

function buildTextAttachmentContext(attachments: AgentMessage["attachments"]): string {
  if (!attachments || attachments.length === 0) return "";

  const textAttachments = attachments.filter((a) => a.contentType === "text");
  if (textAttachments.length === 0) return "";

  const parts = textAttachments.map((a) => {
    return `--- Archivo adjunto: ${a.name} (tipo: ${a.mimeType}) ---\n${a.textContent || ""}\n--- Fin ${a.name} ---`;
  });

  return "\n\nArchivos adjuntos de texto:\n" + parts.join("\n\n");
}

function messageToContent(msg: AgentMessage): { role: "user" | "model"; parts: Part[] } {
  // Tool result -> must be a `user` message with a `functionResponse` part.
  // Gemini requires the functionResponse to be paired with the model message
  // that contained the matching functionCall. We syntheticly attach each
  // tool result as its own user message with a single functionResponse part.
  if (msg.role === "tool" && msg.toolName) {
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: msg.toolName,
            response: { result: msg.content },
          },
        } as Part,
      ],
    };
  }

  const parts: Part[] = [];

  // assistant text (and any attachments for user messages)
  const textContext = buildTextAttachmentContext(msg.attachments);
  const fullText = msg.content + textContext;
  if (fullText.trim()) {
    parts.push({ text: fullText });
  }

  // assistant functionCalls
  if (msg.role === "assistant" && msg.functionCalls && msg.functionCalls.length > 0) {
    for (const fc of msg.functionCalls) {
      parts.push({
        functionCall: {
          name: fc.name,
          args: fc.args,
        },
      } as Part);
    }
  }

  // binary attachments (image/pdf) for user messages
  const binaryAttachments =
    msg.attachments?.filter((a) => a.contentType === "image" || a.contentType === "pdf") || [];
  for (const attachment of binaryAttachments) {
    if (attachment.base64Content) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.base64Content,
        },
      } as Part);
    }
  }

  // Determine role. Assistant -> model. User -> user.
  // If an assistant message only has functionCalls and no text, we still
  // need a model message so Gemini can match it with the user's
  // functionResponse.
  const role: "user" | "model" = msg.role === "assistant" ? "model" : "user";

  return { role, parts };
}

export async function runAgentLoop(
  options: AgentEngineOptions,
  history: AgentMessage[],
  tools: AgentTool[],
  maxIterations: number = 15,
  onProgress?: (messages: AgentMessage[]) => void,
): Promise<{ messages: AgentMessage[]; assistantText: string }> {
  const ai = new GoogleGenAI({ apiKey: options.apiKey });

  const contextTool = tools.find((t) => t.name === "get_current_context");
  const contextText = contextTool ? await contextTool.execute({}) : "No contexto";
  const systemInstruction = buildSystemInstruction(contextText);

  const currentHistory = [...history];
  let iterations = 0;
  let lastAssistantText = "";

  while (iterations < maxIterations) {
    iterations++;

    const contents = currentHistory.map(messageToContent);

    const response = await ai.models.generateContent({
      model: options.model || "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: convertToolsForGemini(tools) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const textParts = parts.filter((p) => p.text).map((p) => p.text);
    const functionCallParts = parts.filter((p) => p.functionCall);

    const assistantText = textParts.join("\n").trim();
    const functionCallEntries: FunctionCallEntry[] = functionCallParts.map((p) => ({
      name: (p.functionCall as { name: string }).name,
      args: ((p.functionCall as { args?: Record<string, unknown> }).args || {}) as Record<string, unknown>,
    }));

    // IMPORTANT: push a model message that preserves BOTH the text and the
    // functionCalls. Without the functionCall parts in the history, Gemini
    // won't be able to match the functionResponse we send next, and the
    // loop will stall or repeat tools.
    if (assistantText || functionCallEntries.length > 0) {
      currentHistory.push({
        role: "assistant",
        content: assistantText,
        functionCalls: functionCallEntries.length > 0 ? functionCallEntries : undefined,
      });
      if (assistantText) lastAssistantText = assistantText;
      onProgress?.([...currentHistory]);
    }

    // No tool calls -> the model finished its turn.
    if (functionCallEntries.length === 0) {
      return {
        messages: currentHistory,
        assistantText: assistantText || lastAssistantText || "Hecho.",
      };
    }

    // Execute each tool and push one `tool` message per call. Each one will
    // become a `user` `functionResponse` part when sent back to Gemini.
    for (const fc of functionCallEntries) {
      const tool = tools.find((t) => t.name === fc.name);
      if (!tool) {
        currentHistory.push({
          role: "tool",
          content: `Herramienta desconocida: ${fc.name}`,
          toolName: fc.name,
          toolArgs: fc.args,
        });
        onProgress?.([...currentHistory]);
        continue;
      }

      let resultText: string;
      try {
        resultText = await tool.execute(fc.args);
      } catch (error) {
        resultText = error instanceof Error ? error.message : "Error ejecutando herramienta";
      }

      currentHistory.push({
        role: "tool",
        content: resultText,
        toolName: tool.name,
        toolArgs: fc.args,
      });
      onProgress?.([...currentHistory]);
    }
  }

  return {
    messages: currentHistory,
    assistantText:
      "He alcanzado el límite de iteraciones. La tarea puede estar incompleta. Indícame si quieres que continúe.",
  };
}
