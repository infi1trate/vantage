import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Video, Edit3, Scissors, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: Video,
    title: "Record Gameplay",
    description: "Capture your gaming session using Vantage or upload an existing recording.",
  },
  {
    icon: Edit3,
    title: "Annotate the Moment",
    description: "Mark the exact moment that qualifies for this challenge.",
  },
  {
    icon: Scissors,
    title: "Clip the Moment",
    description: "Trim your clip to include just the qualifying action within duration limits.",
  },
  {
    icon: Send,
    title: "Submit to Challenge",
    description: "Add a title and any proof notes, then submit your entry before the deadline.",
  },
];

export function HowToParticipate() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                How to Participate
              </span>
              <ChevronDown className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className="relative p-4 rounded-lg border border-border/50 bg-background/50"
                >
                  {/* Step number */}
                  <div className="absolute -top-2.5 -left-2.5 h-6 w-6 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center">
                    {index + 1}
                  </div>
                  
                  <step.icon className="h-6 w-6 text-primary mb-3" />
                  <h4 className="font-medium text-sm mb-1">{step.title}</h4>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
