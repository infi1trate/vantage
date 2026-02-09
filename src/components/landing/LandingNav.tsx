import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Skip link for keyboard users */}
      <a href="#hero-heading" className="skip-link">
        Skip to main content
      </a>
      
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          "bg-background/60 backdrop-blur-md",
          hasScrolled ? "border-b border-border/50" : "border-b border-transparent"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center focus-visible:ring-offset-background"
            aria-label="Vantage home"
          >
            <span className="font-display text-2xl tracking-wide text-primary">
              Vantage
            </span>
          </Link>

          {/* Right side actions */}
          <div className="flex items-center gap-4" role="group" aria-label="Account actions">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-offset-background"
              onClick={() => {
                const el = document.getElementById("waitlist-input");
                if (el) { el.scrollIntoView({ behavior: "smooth" }); setTimeout(() => el.focus(), 500); }
              }}
            >
              Join Waitlist
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
