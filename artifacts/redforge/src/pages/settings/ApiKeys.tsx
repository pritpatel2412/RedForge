import { useState } from "react";
import { useListApiKeys, useCreateApiKey, useDeleteApiKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Key, Trash2, Plus, Loader2, Copy, Check } from "lucide-react";
import SettingsLayout from "./SettingsLayout";
import { formatDate } from "@/lib/utils";

export default function ApiKeys() {
  const { data: keys, isLoading } = useListApiKeys();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { mutate: create, isPending: isCreating } = useCreateApiKey({
    mutation: {
      onSuccess: (data) => {
        setNewSecret(data.secret);
        setName("");
        queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
        toast.success("API Key generated");
      },
      onError: (err: any) => toast.error(err.message || "Failed to generate key")
    }
  });

  const { mutate: deleteKey, isPending: isDeleting } = useDeleteApiKey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
        toast.success("API Key deleted");
      }
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    create({ data: { name } });
  };

  const copySecret = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <SettingsLayout><div className="skeleton h-64 rounded-2xl" /></SettingsLayout>;

  return (
    <SettingsLayout>
      <div className="space-y-6">
        
        {newSecret && (
          <div className="bg-primary/10 border border-primary/30 p-6 rounded-2xl animate-in slide-in-from-top-4">
            <h3 className="text-primary font-bold mb-2">API Key Created Successfully</h3>
            <p className="text-sm text-zinc-300 mb-4">Please copy your secret key now. You will not be able to see it again.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black border border-primary/20 px-4 py-3 rounded-xl text-primary font-mono select-all">
                {newSecret}
              </code>
              <button 
                onClick={copySecret}
                className="p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <button 
              onClick={() => setNewSecret(null)}
              className="mt-4 text-sm text-muted-foreground hover:text-white underline"
            >
              I have saved it securely
            </button>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Active API Keys</h2>
              <p className="text-sm text-muted-foreground">Keys used to authenticate with the RedForge API.</p>
            </div>
            
            <form onSubmit={handleCreate} className="flex items-center gap-2">
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Key Name (e.g. CI/CD)"
                className="bg-background border border-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-primary transition-all w-48"
                required
              />
              <button 
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Key
              </button>
            </form>
          </div>

          <div className="divide-y divide-border">
            {keys?.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                <Key className="w-8 h-8 mb-3 opacity-20" />
                No API keys generated yet.
              </div>
            ) : (
              keys?.map(k => (
                <div key={k.id} className="py-4 flex items-center justify-between group">
                  <div>
                    <div className="font-semibold text-white mb-1 flex items-center gap-2">
                      {k.name}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono bg-zinc-900 px-2 py-0.5 rounded w-fit mb-2">
                      {k.keyPreview}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(k.createdAt)} • Last used {k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm("Revoke this API key? This action cannot be undone.")) {
                        deleteKey({ id: k.id });
                      }
                    }}
                    disabled={isDeleting}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
