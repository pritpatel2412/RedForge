import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, Loader2, Globe, Server, Smartphone, Database } from "lucide-react";

export default function ProjectNew() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [targetType, setTargetType] = useState<"WEB_APP" | "API" | "MOBILE_API" | "GRAPHQL">("WEB_APP");

  const { mutate: create, isPending } = useCreateProject({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast.success("Project created successfully");
        setLocation(`/projects/${data.id}`);
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to create project");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create({ data: { name, description, targetUrl, targetType } });
  };

  const types = [
    { id: "WEB_APP", label: "Web Application", icon: Globe, desc: "Standard frontend + backend scan" },
    { id: "API", label: "REST API", icon: Server, desc: "Endpoint and specification testing" },
    { id: "GRAPHQL", label: "GraphQL API", icon: Database, desc: "Introspection and query testing" },
    { id: "MOBILE_API", label: "Mobile API", icon: Smartphone, desc: "Mobile-specific backend endpoints" }
  ] as const;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-white flex items-center gap-2 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">New Target</h1>
        <p className="text-muted-foreground">Configure a new application or API for penetration testing.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-card border border-border rounded-2xl p-6 md:p-8">
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Project Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Production API"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              required
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-zinc-300 block mb-2">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the application..."
              rows={3}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-zinc-300 block">Target Type</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {types.map(t => (
              <div 
                key={t.id}
                onClick={() => setTargetType(t.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${targetType === t.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-zinc-500'}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <t.icon className={`w-5 h-5 ${targetType === t.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-semibold text-white">{t.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-300 block mb-2">Target URL</label>
          <div className="flex">
            <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-border bg-muted text-muted-foreground text-sm">
              https://
            </span>
            <input 
              type="text" 
              value={targetUrl.replace(/^https?:\/\//, '')}
              onChange={e => setTargetUrl(`https://${e.target.value.replace(/^https?:\/\//, '')}`)}
              placeholder="api.company.com"
              className="flex-1 bg-background border border-border rounded-r-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              required
            />
          </div>
        </div>

        <div className="pt-6 border-t border-border flex justify-end gap-4">
          <Link href="/projects" className="px-6 py-3 rounded-xl border border-border hover:bg-muted font-medium transition-colors">
            Cancel
          </Link>
          <button 
            type="submit"
            disabled={isPending}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
