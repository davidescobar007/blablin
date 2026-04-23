import { useState } from "react";
import { usePocketBase } from "../context/usePocketBase";
import { X, Save, Sparkles, Database } from "lucide-react";
import { AIConfigImportExport } from "./molecules/AIConfigImportExport";

interface AISettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISettingsDialog({
  isOpen,
  onClose,
}: AISettingsDialogProps) {
  const { aiApiKey, setAIApiKey, reloadAIConfigs } = usePocketBase();
  const [inputKey, setInputKey] = useState("");

  const handleSave = () => {
    setAIApiKey(inputKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-800">AI Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Google AI API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Enter your Gemini API key..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Get your API key from{" "}
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {aiApiKey && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Sparkles className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">
                API Key is configured ✓
              </span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-slate-500" />
              <h4 className="text-sm font-medium text-slate-700">
                AI Column Configurations
              </h4>
            </div>
            <AIConfigImportExport onImportSuccess={reloadAIConfigs} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save API Key
          </button>
        </div>
      </div>
    </div>
  );
}
