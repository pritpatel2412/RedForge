import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Shield, 
  Bug, 
  Settings, 
  Key, 
  CreditCard,
  LogOut,
  Target,
  Plus,
  FileText
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { mutate: doLogout } = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
        setOpen(false);
      }
    }
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (!open) return null;

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
        style={{ "--cmdk-input-height": "48px" } as React.CSSProperties}
      >
        <Command
          label="Command Menu"
          loop
          className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-zinc-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
        >
          <div className="flex items-center border-b border-zinc-800 px-4 py-3">
            <Command.Input
              placeholder="Type a command or search..."
              autoFocus
              className="flex-1 bg-transparent text-white placeholder:text-zinc-500 outline-none text-sm"
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-zinc-500">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigate">
              <CmdItem icon={LayoutDashboard} onSelect={() => runCommand(() => setLocation("/dashboard"))}>
                Dashboard
              </CmdItem>
              <CmdItem icon={Shield} onSelect={() => runCommand(() => setLocation("/projects"))}>
                Projects
              </CmdItem>
              <CmdItem icon={Target} onSelect={() => runCommand(() => setLocation("/scans"))}>
                Scans
              </CmdItem>
              <CmdItem icon={Bug} onSelect={() => runCommand(() => setLocation("/findings"))}>
                Findings
              </CmdItem>
            </Command.Group>

            <Command.Group heading="Actions">
              <CmdItem icon={Plus} onSelect={() => runCommand(() => setLocation("/projects/new"))}>
                New Project Target
              </CmdItem>
            </Command.Group>

            <Command.Group heading="Settings">
              <CmdItem icon={Settings} onSelect={() => runCommand(() => setLocation("/settings"))}>
                Workspace Settings
              </CmdItem>
              <CmdItem icon={Key} onSelect={() => runCommand(() => setLocation("/settings/api-keys"))}>
                API Keys
              </CmdItem>
              <CmdItem icon={CreditCard} onSelect={() => runCommand(() => setLocation("/settings/billing"))}>
                Billing & Plan
              </CmdItem>
            </Command.Group>

            <Command.Group heading="Account">
              <CmdItem icon={LogOut} onSelect={() => doLogout()} danger>
                Sign Out
              </CmdItem>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CmdItem({
  icon: Icon,
  onSelect,
  children,
  danger,
}: {
  icon: React.ElementType;
  onSelect: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors
        data-[selected=true]:bg-zinc-800 data-[selected=true]:text-white
        ${danger ? "text-red-400 data-[selected=true]:text-red-400" : "text-zinc-300"}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </Command.Item>
  );
}
