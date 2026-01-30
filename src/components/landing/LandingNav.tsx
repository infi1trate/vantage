import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl tracking-wider text-primary glow-text">
            VANTAGE
          </span>
        </Link>
        
        <div className="flex items-center gap-6">
          <a 
            href="#features" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <Button asChild variant="outline" size="sm" className="border-primary/50 hover:border-primary hover:bg-primary/10">
            <Link to="/auth">Login</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
