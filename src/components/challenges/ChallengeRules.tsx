import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

interface ChallengeRulesProps {
  rules: string | null;
}

export function ChallengeRules({ rules }: ChallengeRulesProps) {
  if (!rules) return null;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScrollText className="h-5 w-5 text-primary" />
          Rules & Requirements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm prose-invert max-w-none">
          {rules.split('\n').map((line, i) => (
            <p key={i} className="text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
