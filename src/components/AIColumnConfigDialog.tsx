import { useState, useEffect } from "react";
import { usePocketBase, GEMINI_MODELS } from "../context/usePocketBase";
import { X, Wand2, Sparkles, Variable, Image as ImageIcon } from "lucide-react";

interface AIColumnConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  collectionSchema?: Array<{ name: string; type: string }>;
}

export function AIColumnConfigDialog({
  isOpen,
  onClose,
  columnName,
  collectionSchema = [],
}: AIColumnConfigDialogProps) {
  const { selectedCollection, getAIConfig, setAIConfig } = usePocketBase();
  const [prompt, setPrompt] = useState("");
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [formatInstructions, setFormatInstructions] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [generateImage, setGenerateImage] = useState(false);

  useEffect(() => {
    if (isOpen && selectedCollection) {
      const config = getAIConfig(selectedCollection.name, columnName);
      if (config) {
        setPrompt(config.defaultPrompt || "");
        setSelectedVariables(config.defaultVariableColumns || []);
        setFormatInstructions(config.formatInstructions || "");
        setSelectedModel(config.model || "gemini-2.5-flash");
        setGenerateImage(config.generateImage || false);
      } else {
        setPrompt("");
        setSelectedVariables([]);
        setFormatInstructions("");
        setSelectedModel("gemini-2.5-flash");
        setGenerateImage(false);
      }
    }
  }, [isOpen, selectedCollection, columnName, getAIConfig]);

  const availableVariables = collectionSchema.map((f) => f.name);

  const handleToggleVariable = (variable: string) => {
    setSelectedVariables((prev) =>
      prev.includes(variable)
        ? prev.filter((v) => v !== variable)
        : [...prev, variable],
    );
  };

  const handleSave = () => {
    if (!selectedCollection) return;

    if (prompt.trim()) {
      setAIConfig(
        selectedCollection.name,
        columnName,
        {
          defaultPrompt: prompt.trim(),
          defaultVariableColumns: selectedVariables,
          formatInstructions: formatInstructions.trim() || undefined,
          model: selectedModel,
          generateImage,
        },
      );
    } else {
      setAIConfig(selectedCollection.name, columnName, null);
    }
    onClose();
  };

  const handleClear = () => {
    setPrompt("");
    setSelectedVariables([]);
    setFormatInstructions("");
    setSelectedModel("gemini-2.5-flash");
    setGenerateImage(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-800">
              Configure AI for "{columnName}"
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Prompt Template (Markdown supported)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Generate content about {topic_name} for {level} level...`}
              rows={8}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Use {"{variable}"} syntax for placeholders that will be
              replaced with column values
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Variable className="w-4 h-4" />
              Variables
            </label>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => handleToggleVariable(variable)}
                  className={`px-3 py-1.5 rounded-lg text-sm border-2 transition-colors ${
                    selectedVariables.includes(variable)
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {selectedVariables.includes(variable) && (
                    <Sparkles className="w-3 h-3 inline mr-1" />
                  )}
                  {variable}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {[
                { models: GEMINI_MODELS.filter(m => m.category === 'stable' && m.type === 'text'), label: 'Stable Text Models' },
                { models: GEMINI_MODELS.filter(m => m.category === 'experimental' && m.type === 'text'), label: 'Experimental Text Models' },
                { models: GEMINI_MODELS.filter(m => m.category === 'image'), label: 'Image Models' },
                { models: GEMINI_MODELS.filter(m => m.category === 'experimental' && m.type === 'image'), label: 'Experimental Image Models' },
              ].map((group, groupIndex) => {
                if (group.models.length === 0) return null;
                return (
                  <optgroup key={`${group.label}-${groupIndex}`} label={group.label}>
                    {group.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Select a model. Experimental models may perform better but are less stable.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="generateImage"
              checked={generateImage}
              onChange={(e) => setGenerateImage(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="generateImage" className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ImageIcon className="w-4 h-4" />
              Generate image
            </label>
          </div>
          <p className="text-xs text-slate-500 -mt-1">
            Check this to generate images instead of text (for file-type columns)
          </p>

          {!generateImage && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Format Instructions (Optional)
              </label>
              <textarea
                value={formatInstructions}
                onChange={(e) => setFormatInstructions(e.target.value)}
                placeholder={`IMPORTANT: Return ONLY the essential content without:
- Introductions or explanations
- Conversational filler ("Here's your material...", "As an expert...")
- Unnecessary formatting or excessive emojis
- Meta-commentary or cultural notes

Just provide direct, clean content needed for the study material.`}
                rows={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Instructions to control format and content of AI responses
              </p>
            </div>
          )}

          {selectedVariables.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-medium text-slate-700 mb-2">Preview:</p>
              <code className="text-xs font-mono text-slate-600 whitespace-pre-wrap break-all">
                {selectedVariables.reduce(
                  (preview, v) =>
                    preview.replace(new RegExp(`\\{${v}\\}`, "g"), `{${v}: value}`),
                  prompt || "(empty prompt)",
                )}
              </code>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 mt-6">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Clear AI Config
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
