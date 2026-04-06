import { Link, useLocation } from "wouter";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const tabs = [
    { name: "Workspace", href: "/settings" },
    { name: "API Keys", href: "/settings/api-keys" },
    { name: "Billing", href: "/settings/billing" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace configuration and billing.</p>
      </div>

      <div className="flex border-b border-border">
        {tabs.map((tab) => {
          const isActive = location === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                isActive 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
