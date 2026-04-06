import { useListProjects } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Shield, Plus, ArrowRight, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ProjectList() {
  const { data: projects, isLoading } = useListProjects();

  if (isLoading) {
    return <div className="skeleton h-64 rounded-2xl" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Projects</h1>
          <p className="text-muted-foreground">Manage your scan targets and applications</p>
        </div>
        <Link href="/projects/new" className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.map(project => (
          <Link key={project.id} href={`/projects/${project.id}`} className="bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all rounded-2xl p-6 group flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Shield className="w-5 h-5 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              {project.status === 'ACTIVE' && (
                <span className="flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
              )}
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1 truncate">{project.name}</h3>
            <div className="text-sm text-muted-foreground mb-6 flex items-center gap-1 truncate">
              <ExternalLink className="w-3 h-3" /> {project.targetUrl}
            </div>

            <div className="mt-auto pt-4 border-t border-border grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Scans</div>
                <div className="font-semibold text-white">{project.scanCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Findings</div>
                <div className="font-semibold text-white">{project.findingCount}</div>
              </div>
              <div>
                <div className="text-xs text-red-400 mb-1">Critical</div>
                <div className="font-semibold text-red-500">{project.criticalCount}</div>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Last scan: {project.lastScanAt ? formatDate(project.lastScanAt) : 'Never'}</span>
              <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
            </div>
          </Link>
        ))}

        {projects?.length === 0 && (
          <div className="col-span-full py-20 text-center border border-dashed border-border rounded-2xl">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first target to start scanning for vulnerabilities.</p>
            <Link href="/projects/new" className="text-primary hover:underline font-medium">Create Project</Link>
          </div>
        )}
      </div>
    </div>
  );
}
