

export function FooterSection() {
  return (
    <footer className="py-12 border-t border-border/30" role="contentinfo">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="font-display text-xl tracking-wider text-primary">VANTAGE</span>
            <span className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} All rights reserved.
            </span>
          </div>
          
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            <a 
              href="#features" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-offset-background"
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-offset-background"
            >
              How It Works
            </a>
            <a 
              href="/auth" 
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              Login
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
