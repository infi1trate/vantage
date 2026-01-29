import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Crosshair, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="fixed inset-0 bg-[linear-gradient(hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      
      <div className="relative text-center px-4">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Crosshair className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <h1 className="text-8xl font-bold font-mono text-gradient-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">This page doesn't exist.</p>
        
        <Link to="/">
          <Button size="lg" className="glow-primary">
            <Home className="mr-2 h-5 w-5" />
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
