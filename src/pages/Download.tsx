import { Link } from "react-router-dom";
import { LandingNav } from "@/components/landing/LandingNav";
import { Button } from "@/components/ui/button";
import { Apple, ArrowLeft, Monitor, Shield, Zap } from "lucide-react";

export default function Download() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          {/* Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-8">
            <Monitor className="h-10 w-10 text-primary" />
          </div>

          <h1 className="font-display text-4xl md:text-5xl tracking-wide mb-4">
            Vantage Desktop
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            Record your gameplay natively on macOS. Lightweight, low-latency,
            and built for competitive players.
          </p>

          {/* Download CTA */}
          <Button size="lg" className="h-14 px-10 text-lg gap-3 mb-6" asChild>
            <a href="https://getvantage.app/download/mac" target="_blank" rel="noopener noreferrer">
              <Apple className="h-5 w-5" />
              Download for macOS
            </a>
          </Button>

          <p className="text-xs text-muted-foreground mb-16">
            macOS 13+ required · Apple Silicon & Intel supported
          </p>

          {/* Feature pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            <div className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border/40 bg-card/50">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Low Overhead</span>
              <span className="text-xs text-muted-foreground text-center">
                Hardware-accelerated capture with minimal FPS impact
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border/40 bg-card/50">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Private by Default</span>
              <span className="text-xs text-muted-foreground text-center">
                Recordings stay on your machine until you choose to upload
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border/40 bg-card/50">
              <Monitor className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Multi-Track</span>
              <span className="text-xs text-muted-foreground text-center">
                Separate gameplay, facecam, and audio tracks for full editing control
              </span>
            </div>
          </div>

          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
