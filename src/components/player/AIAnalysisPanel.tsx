import { useState } from "react";
import { AIAnalysis } from "@/lib/captures";
import { FeedbackCard, FeedbackCardData } from "./FeedbackCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Target, 
  Lightbulb, 
  TrendingUp,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Pattern {
  name: string;
  description: string;
  frequency: string;
  impact: "positive" | "negative" | "neutral";
}

interface Recommendation {
  text: string;
  priority: "high" | "medium" | "low";
  category: string;
}

interface AIAnalysisPanelProps {
  analyses: AIAnalysis[];
  feedbackCards?: FeedbackCardData[];
  patterns?: Pattern[];
  recommendations?: Recommendation[];
  onRequestAnalysis: () => void;
  onSeekTo?: (time: number) => void;
  isAnalyzing: boolean;
  analysisError?: string | null;
}

export function AIAnalysisPanel({ 
  analyses, 
  feedbackCards = [],
  patterns = [],
  recommendations = [],
  onRequestAnalysis,
  onSeekTo,
  isAnalyzing,
  analysisError,
}: AIAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState("feedback");

  const latestAnalysis = analyses[0];
  const hasContent = feedbackCards.length > 0 || latestAnalysis;

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

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "positive": return "text-vantage-success bg-vantage-success/10";
      case "negative": return "text-destructive bg-destructive/10";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/20 text-destructive border-destructive/30";
      case "medium": return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Empty state
  if (!hasContent && !isAnalyzing && !analysisError) {
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
            <h4 className="font-semibold mb-2">Get AI-Powered Insights</h4>
            <p className="text-sm text-muted-foreground mb-2">
              AI will analyze your gameplay and voice annotations to provide:
            </p>
            <ul className="text-xs text-muted-foreground mb-4 space-y-1">
              <li>• Moment-level feedback cards</li>
              <li>• Pattern detection (hesitation, overconfidence)</li>
              <li>• Intent-to-outcome analysis from voice notes</li>
              <li>• Actionable recommendations</li>
            </ul>
            <Button onClick={onRequestAnalysis}>
              <Brain className="h-4 w-4 mr-2" />
              Analyze Session
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

      {/* Error state */}
      {analysisError && (
        <div className="p-4 bg-destructive/10 border-b border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{analysisError}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isAnalyzing ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              Analyzing your gameplay...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Reviewing annotations and voice notes
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Score display */}
          {latestAnalysis?.score !== null && latestAnalysis?.score !== undefined && (
            <div className="p-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className={cn("text-4xl font-bold font-mono-data", getScoreColor(latestAnalysis.score))}>
                    {latestAnalysis.score}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getScoreLabel(latestAnalysis.score)}
                  </p>
                </div>
                <Progress 
                  value={latestAnalysis.score} 
                  className="w-32 h-2"
                />
              </div>
              {latestAnalysis.summary && (
                <p className="text-sm text-muted-foreground mt-3">
                  {latestAnalysis.summary}
                </p>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
              <TabsTrigger value="feedback" className="text-xs gap-1">
                <MessageSquare className="h-3 w-3" />
                Feedback ({feedbackCards.length})
              </TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs gap-1">
                <BarChart3 className="h-3 w-3" />
                Patterns ({patterns.length})
              </TabsTrigger>
              <TabsTrigger value="actions" className="text-xs gap-1">
                <Target className="h-3 w-3" />
                Actions ({recommendations.length})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              {/* Feedback Cards */}
              <TabsContent value="feedback" className="p-4 space-y-3 mt-0">
                {feedbackCards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No feedback cards yet</p>
                  </div>
                ) : (
                  feedbackCards.map((card) => (
                    <FeedbackCard 
                      key={card.id} 
                      card={card} 
                      onSeekTo={onSeekTo}
                    />
                  ))
                )}
              </TabsContent>

              {/* Patterns */}
              <TabsContent value="patterns" className="p-4 space-y-3 mt-0">
                {patterns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No patterns detected</p>
                  </div>
                ) : (
                  patterns.map((pattern, index) => (
                    <Card key={index} className="p-3 border border-border/50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{pattern.name}</span>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getImpactColor(pattern.impact))}
                        >
                          {pattern.impact}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {pattern.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Frequency:</span> {pattern.frequency}
                      </p>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Recommendations */}
              <TabsContent value="actions" className="p-4 space-y-3 mt-0">
                {recommendations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recommendations yet</p>
                  </div>
                ) : (
                  recommendations.map((rec, index) => (
                    <Card key={index} className="p-3 border border-border/50 bg-primary/5">
                      <div className="flex items-start gap-3">
                        <Target className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getPriorityColor(rec.priority))}
                            >
                              {rec.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rec.category}
                            </Badge>
                          </div>
                          <p className="text-sm">{rec.text}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </>
      )}
    </Card>
  );
}
