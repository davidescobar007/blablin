import { Database } from "lucide-react";
import { PocketBaseProvider } from "./context/PocketBaseContext";
import { usePocketBase } from "./context/usePocketBase";
import { ConnectionForm } from "./components/organisms/ConnectionForm";
import { CollectionSelector } from "./components/CollectionSelector";
import { RecordsTable } from "./components/organisms/RecordsTable";

function AppContent() {
  const { isConnected } = usePocketBase();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-8 h-8 text-blue-600" />
            PocketBase Bulk Editor
          </h1>
          <p className="text-gray-600 mt-2">
            Connect to your PocketBase instance and bulk edit records
          </p>
        </header>

        {!isConnected ? (
          <ConnectionForm />
        ) : (
          <div className="space-y-4">
            <div className="sticky top-0 z-30 bg-gray-50/95 backdrop-blur-sm -mx-8 px-8 py-3 border-b border-slate-200">
              <CollectionSelector />
            </div>
            <RecordsTable />
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <PocketBaseProvider>
      <AppContent />
    </PocketBaseProvider>
  );
}

export default App;
