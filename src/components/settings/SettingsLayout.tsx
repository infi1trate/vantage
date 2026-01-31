import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProfileSection } from "./sections/ProfileSection";
import { AccountSection } from "./sections/AccountSection";
import { PreferencesSection } from "./sections/PreferencesSection";
import { PrivacySection } from "./sections/PrivacySection";
import { SessionsSection } from "./sections/SessionsSection";
import { 
  User, 
  Shield, 
  Settings2, 
  Lock, 
  Laptop,
  ChevronRight
} from "lucide-react";

type SettingsTab = "profile" | "account" | "preferences" | "privacy" | "sessions";

const tabs: { id: SettingsTab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "profile", label: "Profile", icon: User, description: "Your public identity" },
  { id: "account", label: "Account", icon: Lock, description: "Email & password" },
  { id: "preferences", label: "Preferences", icon: Settings2, description: "Recording & display" },
  { id: "privacy", label: "Privacy", icon: Shield, description: "Blocked users & data" },
  { id: "sessions", label: "Sessions", icon: Laptop, description: "Active devices" },
];

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [showMobileNav, setShowMobileNav] = useState(true);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setShowMobileNav(false);
  };

  const handleBackToNav = () => {
    setShowMobileNav(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="font-barlow text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-wide text-foreground">
          Account Settings
        </h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          Manage your profile, preferences, and security settings
        </p>
      </div>

      {/* Desktop Layout - Side by Side */}
      <div className="hidden md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground border border-transparent"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "")} />
                <div className="min-w-0">
                  <span className={cn(
                    "block text-sm font-medium truncate",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {tab.label}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {tab.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Desktop Content */}
        <div className="min-w-0">
          <SettingsContent activeTab={activeTab} />
        </div>
      </div>

      {/* Mobile Layout - Stack with back navigation */}
      <div className="md:hidden">
        {showMobileNav ? (
          <nav className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-4 rounded-lg",
                    "bg-card border border-border/50 hover:border-primary/30 hover:bg-muted/30",
                    "transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <div className="text-left min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {tab.label}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {tab.description}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </nav>
        ) : (
          <div>
            <button
              onClick={handleBackToNav}
              className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              <span>Back to Settings</span>
            </button>
            <SettingsContent activeTab={activeTab} />
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsContent({ activeTab }: { activeTab: SettingsTab }) {
  switch (activeTab) {
    case "profile":
      return <ProfileSection />;
    case "account":
      return <AccountSection />;
    case "preferences":
      return <PreferencesSection />;
    case "privacy":
      return <PrivacySection />;
    case "sessions":
      return <SessionsSection />;
    default:
      return null;
  }
}
