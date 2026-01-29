import { useState } from "react";
import { AIAnalysis } from "@/lib/captures";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Target, 
  MapPin, 
  Lightbulb, 
  TrendingUp,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface AIAnalysisPanelProps {
  analyses: AIAnalysis[];
  onRequestAnalysis: () => void;
  isAnalyzing: boolean;
}

export function AIAnalysisPanel({ 
  analyses, 
  onRequestAnalysis, 
  isAnalyzing 
}: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const latestAnalysis = analyses[0];

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-vantage-success";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 80) return "Great";
    if (score >= 70) return "Good";
    if (score >= 60) return "Average";
    if (score >= 50) return "Needs Work";
    return "Poor";
  };

  if (!latestAnalysis && !isAnalyzing) {
    return (
      <Card className="flex flex-col h-full bg-card border-border/50">
        <div className="p-4 border-b border-border/50">
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Analysis
          </h3>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h4 className="font-semibold mb-2">No analysis yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Get AI-powered insights on your gameplay
            </p>
            <Button onClick={onRequestAnalysis}>
              <Brain className="h-4 w-4 mr-2" />
              Analyze Gameplay
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Analysis
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRequestAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                Re-analyze
              </>
            )}
          </Button>
        </div>
      </div>

      {isAnalyzing ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Analyzing your gameplay...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take a moment
            </p>
          </div>
        </div>
      ) : latestAnalysis ? (
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Score */}
            {latestAnalysis.score !== null && (
              <div className="mb-6 text-center">
                <div className={`text-5xl font-bold font-mono-data ${getScoreColor(latestAnalysis.score)}`}>
                  {latestAnalysis.score}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {getScoreLabel(latestAnalysis.score)}
                </p>
                <Progress 
                  value={latestAnalysis.score} 
                  className="mt-3 h-2"
                />
              </div>
            )}

            {/* Summary */}
            {latestAnalysis.summary && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">
                  {latestAnalysis.summary}
                </p>
              </div>
            )}

            {/* Insights */}
            {latestAnalysis.insights && latestAnalysis.insights.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Key Insights
                </h4>
                <div className="space-y-2">
                  {latestAnalysis.insights.map((insight: any, index: number) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-start gap-2">
                        {insight.type === "positive" ? (
                          <CheckCircle className="h-4 w-4 text-vantage-success shrink-0 mt-0.5" />
                        ) : insight.type === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        )}
                        <div>
                          {insight.title && (
                            <p className="text-sm font-medium">{insight.title}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {insight.description || insight}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {latestAnalysis.recommendations && latestAnalysis.recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" />
                  Recommendations
                </h4>
                <div className="space-y-2">
                  {latestAnalysis.recommendations.map((rec: any, index: number) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg bg-accent/5 border border-accent/20"
                    >
                      <p className="text-sm">
                        {rec.text || rec}
                      </p>
                      {rec.priority && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          Priority: {rec.priority}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      ) : null}
    </Card>
  );
}
