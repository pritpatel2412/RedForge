import { useState, useEffect } from "react";
import { useGetWorkspaceSettings, useUpdateWorkspaceSettings } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
import SettingsLayout from "./SettingsLayout";

export default function WorkspaceSettings() {
  const { data: settings, isLoading } = useGetWorkspaceSettings();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [slackUrl, setSlackUrl] = useState("");

  useEffect(() => {
    if (settings) {
      setName(settings.name || "");
      setSlackUrl(settings.slackWebhookUrl || "");
    }
  }, [settings]);

  const { mutate: update, isPending } = useUpdateWorkspaceSettings({
    mutation: {
      onSuccess: () => {
        toast.success("Workspace updated");
        queryClient.invalidateQueries({ queryKey: ["/api/workspace/settings"] });
      },
      onError: (err: any) => toast.error(err.message || "Update failed")
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update({ data: { name, slackWebhookUrl: slackUrl } });
  };

  if (isLoading) return <SettingsLayout><div className="skeleton h-64 rounded-2xl" /></SettingsLayout>;

  return (
    <SettingsLayout>
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-border pb-4">General Configuration</h2>
          
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Workspace Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all max-w-md"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Workspace Slug</label>
            <input 
              type="text" 
              value={settings?.slug || ""}
              disabled
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-muted-foreground max-w-md opacity-70 cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-2">The slug is used in your API URLs and cannot be changed.</p>
          </div>
        </div>

        <div className="space-y-4 pt-6">
          <h2 className="text-lg font-bold text-white border-b border-border pb-4">Integrations</h2>
          
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Slack Webhook URL</label>
            <input 
              type="url" 
              value={slackUrl}
              onChange={e => setSlackUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all max-w-md"
            />
            <p className="text-xs text-muted-foreground mt-2">Get notified instantly when new critical vulnerabilities are found.</p>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <button 
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </form>
    </SettingsLayout>
  );
}
