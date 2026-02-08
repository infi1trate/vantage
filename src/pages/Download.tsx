import { useState, useCallback } from "react";
import vantageAppIcon from "@/assets/vantage-app-icon.png";
import { LandingNav } from "@/components/landing/LandingNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Apple,
  Download as DownloadIcon,
  Monitor,
  Mic,
  Camera,
  Shield,
  FolderOpen,
  MousePointerClick,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { openVantageApp } from "@/lib/desktopDeepLink";

const DOWNLOAD_URL = "https://www.dropbox.com/scl/fi/nibofwti4pf9rtw591i6e/Vantage-Desktop-0.1.0-arm64-mac.zip?rlkey=vtcmh6zpanea8poou7lbqwtf8&dl=1";

export default function DownloadPage() {
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  const [deepLinkStatus, setDeepLinkStatus] = useState<
    "idle" | "attempting" | "success" | "failed"
  >("idle");

  const handleOpenVantage = useCallback(async () => {
    setDeepLinkStatus("attempting");
    const result = await openVantageApp();
    setDeepLinkStatus(result === "opened" ? "success" : "failed");
  }, []);

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    // Local success state for now
    setWaitlistSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="container mx-auto px-6 pt-28 sm:pt-36 pb-20">
        {/* ─── Hero ─── */}
        <section className="max-w-3xl mx-auto text-center mb-20">
          <img
            src={vantageAppIcon}
            alt="Vantage app icon"
            className="mx-auto h-20 w-20 rounded-2xl mb-8"
          />

          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl tracking-wide mb-4">
            Download Vantage
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Capture gameplay with the desktop app. Review, annotate, and share
            on the web.
          </p>

          {/* macOS CTA */}
          <Button
            size="lg"
            className="h-14 px-10 text-lg gap-3 glow-primary font-bold uppercase tracking-wider"
            asChild
          >
            <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
              <Apple className="h-5 w-5" />
              Download for macOS
            </a>
          </Button>
          <p className="text-xs text-muted-foreground mt-3 font-mono">
            macOS 13+ · Apple Silicon + Intel
          </p>
        </section>

        {/* ─── Windows Waitlist ─── */}
        <section className="max-w-lg mx-auto text-center mb-20">
          <Card className="p-8 bg-card border-border/40">
            <Monitor className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-2xl tracking-wide mb-2">
              Windows is Coming Soon
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              We'll email you when the Windows build is ready.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowWaitlistModal(true)}
              className="uppercase tracking-wider text-sm font-bold"
            >
              Join the Windows Waitlist
            </Button>
          </Card>
        </section>

        {/* ─── Already Installed ─── */}
        <section className="max-w-lg mx-auto text-center mb-20">
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="ghost"
              onClick={handleOpenVantage}
              disabled={deepLinkStatus === "attempting"}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              {deepLinkStatus === "attempting" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Already installed? Open Vantage
            </Button>

            {deepLinkStatus === "success" && (
              <p className="text-sm text-vantage-success flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Vantage should be opening now.
              </p>
            )}

            {deepLinkStatus === "failed" && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-vantage-warning" />
                Couldn't open the app. Make sure Vantage is installed and try
                again.
              </p>
            )}
          </div>
        </section>

        {/* ─── Install Steps ─── */}
        <section className="max-w-3xl mx-auto mb-20">
          <h2 className="font-display text-3xl tracking-wide text-center mb-10">
            Get Started in 3 Steps
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StepCard
              step={1}
              icon={DownloadIcon}
              title="Download the Archive"
              description="Download the .zip file and extract it."
            />
            <StepCard
              step={2}
              icon={FolderOpen}
              title="Drag to Applications"
              description="Drag Vantage into your Applications folder."
            />
            <StepCard
              step={3}
              icon={MousePointerClick}
              title="Open & Approve Permissions"
              description="Open Vantage and grant the required permissions."
            />
          </div>
        </section>

        {/* ─── Permissions Checklist ─── */}
        <section className="max-w-xl mx-auto mb-20">
          <h2 className="font-display text-2xl tracking-wide text-center mb-8">
            Required Permissions
          </h2>

          <div className="space-y-3">
            <PermissionRow
              icon={Monitor}
              label="Screen Recording"
              required
              description="Needed to capture your gameplay"
            />
            <PermissionRow
              icon={Mic}
              label="Microphone"
              required
              description="For voice commentary and comms capture"
            />
            <PermissionRow
              icon={Camera}
              label="Camera"
              description="Optional — for facecam overlay"
            />
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="max-w-2xl mx-auto mb-10">
          <h2 className="font-display text-2xl tracking-wide text-center mb-8">
            Need Help?
          </h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="why-desktop" className="border-border/40">
              <AccordionTrigger className="text-sm text-left hover:no-underline hover:text-primary transition-colors">
                Why does capture require the desktop app?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Browser-based screen capture has significant limitations —
                lower frame rates, higher latency, and inconsistent codec
                support. The desktop app uses hardware-accelerated recording
                with minimal performance impact, giving you clean, multi-track
                footage every time.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="browser-block" className="border-border/40">
              <AccordionTrigger className="text-sm text-left hover:no-underline hover:text-primary transition-colors">
                My browser didn't open the app
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Some browsers block deep links silently. Make sure Vantage is in
                your Applications folder and has been opened at least once. You
                can also try clicking "Open Vantage" above again, or launch the
                app manually.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="permissions" className="border-border/40">
              <AccordionTrigger className="text-sm text-left hover:no-underline hover:text-primary transition-colors">
                How to enable permissions on macOS
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Go to{" "}
                <span className="font-mono text-xs text-foreground">
                  System Settings → Privacy & Security
                </span>
                . Under Screen Recording, Microphone, and Camera, make sure
                Vantage is toggled on. If you don't see Vantage listed, open the
                app once and macOS will prompt you to grant access.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      {/* ─── Windows Waitlist Modal ─── */}
      <Dialog open={showWaitlistModal} onOpenChange={setShowWaitlistModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">
              {waitlistSubmitted
                ? "You're on the List"
                : "Join the Windows Waitlist"}
            </DialogTitle>
            <DialogDescription>
              {waitlistSubmitted
                ? "We'll email you as soon as the Windows build is ready."
                : "Enter your email and we'll notify you when Vantage for Windows launches."}
            </DialogDescription>
          </DialogHeader>

          {waitlistSubmitted ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-vantage-success" />
              <p className="text-sm text-muted-foreground text-center">
                We've saved{" "}
                <span className="font-medium text-foreground">
                  {waitlistEmail}
                </span>
                . Keep an eye on your inbox.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWaitlistModal(false);
                }}
                className="mt-2"
              >
                Done
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleWaitlistSubmit}
              className="flex flex-col gap-4 pt-2"
            >
              <Input
                type="email"
                placeholder="you@example.com"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                required
                className="bg-muted border-border/50"
              />
              <Button type="submit" className="w-full gap-2">
                <Shield className="h-4 w-4" />
                Join Waitlist
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─── */

function StepCard({
  step,
  icon: Icon,
  title,
  description,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-6 bg-card border-border/40 text-center group hover:border-primary/30 transition-colors">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20 mb-4 group-hover:bg-primary/15 transition-colors">
        <span className="font-mono text-sm font-bold text-primary">
          {step}
        </span>
      </div>
      <Icon className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
      <h3 className="font-barlow text-base font-bold uppercase tracking-wider mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {description}
      </p>
    </Card>
  );
}

function PermissionRow({
  icon: Icon,
  label,
  description,
  required,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-card/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {required ? (
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              Required
            </span>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Optional
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
