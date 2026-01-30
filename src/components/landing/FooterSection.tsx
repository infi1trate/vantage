import { Link } from "react-router-dom";

export function FooterSection() {
  return (
    <footer className="py-12 border-t border-border/30">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="font-display text-xl tracking-wider text-primary">VANTAGE</span>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
