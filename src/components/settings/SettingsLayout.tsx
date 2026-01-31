/**
 * Settings Layout Component
 * 
 * QA Checklist:
 * - Test responsive breakpoints: xs, sm, md, lg, xl, 2xl
 * - Verify no content overflows or clips at any size
 * - Verify keyboard navigation works on tabs (arrow keys)
 * - Verify focus states are visible on dark UI
 * - Verify /settings doesn't impact capture flow beyond applying defaults at session start
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AccountSection } from "./sections/AccountSection";
import { SecuritySection } from "./sections/SecuritySection";
import { CameraSection } from "./sections/CameraSection";
import { PrivacySection } from "./sections/PrivacySection";
import { SessionsSection } from "./sections/SessionsSection";
import { ConnectedAccountsSection } from "./sections/ConnectedAccountsSection";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, 
  Shield, 
  Camera,
  Lock, 
  Laptop,
  Link2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

type SettingsTab = "account" | "security" | "camera" | "privacy" | "sessions" | "connected";

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "sessions", label: "Sessions", icon: Laptop },
  { id: "connected", label: "Connected Accounts", icon: Link2 },
];

export function SettingsLayout() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<SettingsTab, HTMLButtonElement | null>>(new Map());
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check scroll position for mobile tab arrows
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1
      );
    };

    checkScroll();
    container.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, []);

  const scrollTabs = (direction: "left" | "right") => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const scrollAmount = 150;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Keyboard navigation for tabs
  const handleTabKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;
    
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  }, []);

  if (loading) {
    return <SettingsLoadingSkeleton />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <h1 className="font-barlow text-2xl sm:text-3xl lg:text-4xl font-bold uppercase tracking-wide text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Manage your account, privacy, and integrations.
          </p>
        </div>
        {/* Plan pill - visible on xl+ */}
        <div className="hidden xl:flex items-center">
          <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
            Vantage — Standard
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Horizontal scrollable tabs */}
      <div className="lg:hidden sticky top-14 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50 mb-6">
        <div className="relative">
          {/* Left scroll arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scrollTabs("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-background/90 border border-border/50 rounded-full shadow-md"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          )}

          {/* Tabs container - uses tablist role for accessibility */}
          <div
            ref={tabsContainerRef}
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="horizontal"
            className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => tabRefs.current.set(tab.id, el)}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right scroll arrow */}
          {showRightArrow && (
            <button
              onClick={() => scrollTabs("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-background/90 border border-border/50 rounded-full shadow-md"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Desktop Layout: Sidebar + Content */}
      <div className="lg:grid lg:grid-cols-[240px_1fr] xl:grid-cols-[280px_1fr] lg:gap-8">
        {/* Desktop Sidebar - uses tablist role for accessibility */}
        <nav 
          className="hidden lg:block space-y-1 sticky top-24 self-start"
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => tabRefs.current.set(tab.id, el)}
                role="tab"
                id={`tab-desktop-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
                  "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-muted-foreground border border-transparent hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "")} aria-hidden="true" />
                <span className={cn(
                  "text-sm font-medium",
                  isActive ? "text-primary" : "text-foreground"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Content Area - uses tabpanel role for accessibility */}
        <div 
          className="min-w-0 max-w-3xl lg:max-w-none"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
        >
          <SettingsContent activeTab={activeTab} />
        </div>
      </div>
    </div>
  );
}

function SettingsContent({ activeTab }: { activeTab: SettingsTab }) {
  switch (activeTab) {
    case "account":
      return <AccountSection />;
    case "security":
      return <SecuritySection />;
    case "camera":
      return <CameraSection />;
    case "privacy":
      return <PrivacySection />;
    case "sessions":
      return <SessionsSection />;
    case "connected":
      return <ConnectedAccountsSection />;
    default:
      return null;
  }
}

function SettingsLoadingSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Header skeleton */}
      <div className="mb-6 sm:mb-8">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Tabs skeleton (mobile) */}
      <div className="lg:hidden mb-6">
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
        {/* Sidebar skeleton (desktop) */}
        <div className="hidden lg:block space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-border/30">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="px-4 sm:px-6 py-5 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
