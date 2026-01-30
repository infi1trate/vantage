import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  MessageSquare,
  Calendar,
  Clock,
  Zap,
  Lightbulb,
  Activity,
  BarChart3,
  Loader2,
  ArrowRight,
  Flame,
  Shield,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";

interface SessionActivity {
  date: string;
  count: number;
  totalDuration: number;
}

interface PatternData {
  name: string;
  description: string;
  frequency: number;
  trend: "increasing" | "decreasing" | "stable";
  impact: "positive" | "negative" | "neutral";
  sessions: string[];
}

interface TagInsight {
  tag: string;
  count: number;
  category: "mistake" | "strength" | "neutral";
  recentTrend: number; // percentage change
}

interface ReasoningPhrase {
  phrase: string;
  count: number;
  sentiment: "confident" | "hesitant" | "frustrated" | "analytical";
  examples: string[];
}

export default function Insights() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  
  // Data states
  const [sessionActivity, setSessionActivity] = useState<SessionActivity[]>([]);
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [tagInsights, setTagInsights] = useState<TagInsight[]>([]);
  const [reasoningPhrases, setReasoningPhrases] = useState<ReasoningPhrase[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalReviewTime, setTotalReviewTime] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadInsightsData();
    }
  }, [user, timeRange]);

  const loadInsightsData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = subDays(new Date(), days);

      // Load sessions
      const { data: sessions } = await supabase
        .from("capture_sessions")
        .select("id, created_at, duration_seconds, title")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: true });

      // Load annotations with tags
      const { data: annotations } = await supabase
        .from("annotations")
        .select("id, tags, annotation_type, timestamp_seconds, session_id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString());

      // Load AI analyses
      const { data: analyses } = await supabase
        .from("ai_analyses")
        .select("id, insights, recommendations, summary, score, session_id, created_at")
        .gte("created_at", startDate.toISOString());

      // Load voice notes with transcriptions
      const { data: voiceNotes } = await supabase
        .from("voice_notes")
        .select("id, transcription, timestamp_seconds, session_id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString());

      // Process session activity
      const activityMap = new Map<string, SessionActivity>();
      const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
      
      dateRange.forEach(date => {
        const key = format(date, "yyyy-MM-dd");
        activityMap.set(key, { date: key, count: 0, totalDuration: 0 });
      });

      sessions?.forEach(session => {
        const key = format(new Date(session.created_at), "yyyy-MM-dd");
        const existing = activityMap.get(key);
        if (existing) {
          existing.count++;
          existing.totalDuration += session.duration_seconds || 0;
        }
      });

      setSessionActivity(Array.from(activityMap.values()));
      setTotalSessions(sessions?.length || 0);
      setTotalReviewTime(sessions?.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) || 0);

      // Process tag insights
      const tagCounts = new Map<string, { count: number; recentCount: number }>();
      const recentCutoff = subDays(new Date(), Math.floor(days / 2));

      annotations?.forEach(ann => {
        const tags = ann.tags || [];
        const isRecent = new Date(ann.created_at) > recentCutoff;
        
        tags.forEach((tag: string) => {
          const existing = tagCounts.get(tag) || { count: 0, recentCount: 0 };
          existing.count++;
          if (isRecent) existing.recentCount++;
          tagCounts.set(tag, existing);
        });

        // Also count annotation types as tags
        if (ann.annotation_type) {
          const existing = tagCounts.get(ann.annotation_type) || { count: 0, recentCount: 0 };
          existing.count++;
          if (isRecent) existing.recentCount++;
          tagCounts.set(ann.annotation_type, existing);
        }
      });

      const mistakeTags = ["death", "mistake", "misplay", "whiff", "bad-timing", "overextend"];
      const strengthTags = ["kill", "clutch", "highlight", "good-play", "ace"];

      const processedTags: TagInsight[] = Array.from(tagCounts.entries())
        .map(([tag, data]) => {
          const oldCount = data.count - data.recentCount;
          const trend = oldCount > 0 
            ? Math.round(((data.recentCount - oldCount) / oldCount) * 100)
            : data.recentCount > 0 ? 100 : 0;

          return {
            tag,
            count: data.count,
            category: mistakeTags.includes(tag.toLowerCase()) 
              ? "mistake" as const
              : strengthTags.includes(tag.toLowerCase())
                ? "strength" as const
                : "neutral" as const,
            recentTrend: trend,
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      setTagInsights(processedTags);

      // Process AI patterns from analyses
      const patternMap = new Map<string, PatternData>();
      
      analyses?.forEach(analysis => {
        const insights = analysis.insights as any[] || [];
        insights.forEach((insight: any) => {
          if (insight?.title) {
            const key = insight.title.toLowerCase();
            const existing = patternMap.get(key) || {
              name: insight.title,
              description: insight.description || "",
              frequency: 0,
              trend: "stable" as const,
              impact: insight.type === "positive" ? "positive" as const 
                : insight.type === "warning" ? "negative" as const 
                : "neutral" as const,
              sessions: [],
            };
            existing.frequency++;
            if (analysis.session_id && !existing.sessions.includes(analysis.session_id)) {
              existing.sessions.push(analysis.session_id);
            }
            patternMap.set(key, existing);
          }
        });
      });

      // Add some behavioral patterns from annotations
      const deathCount = annotations?.filter(a => a.annotation_type === "death").length || 0;
      const killCount = annotations?.filter(a => a.annotation_type === "kill").length || 0;
      
      if (deathCount > 3) {
        patternMap.set("frequent-deaths", {
          name: "Frequent Death Markers",
          description: "You're marking many death moments - this self-awareness is key to improvement",
          frequency: deathCount,
          trend: "stable",
          impact: "neutral",
          sessions: [...new Set(annotations?.filter(a => a.annotation_type === "death").map(a => a.session_id) || [])],
        });
      }

      setPatterns(Array.from(patternMap.values()).sort((a, b) => b.frequency - a.frequency).slice(0, 10));

      // Process reasoning language from voice notes
      const phrasePatterns: Record<string, { pattern: RegExp; sentiment: ReasoningPhrase["sentiment"] }> = {
        "I should have": { pattern: /i should have|should've|i needed to/gi, sentiment: "analytical" },
        "I didn't know": { pattern: /i didn't know|i wasn't sure|wasn't expecting/gi, sentiment: "hesitant" },
        "I knew": { pattern: /i knew|i expected|i predicted/gi, sentiment: "confident" },
        "Why did": { pattern: /why did|what the|how did that/gi, sentiment: "frustrated" },
        "Next time": { pattern: /next time|in the future|i'll try/gi, sentiment: "analytical" },
        "I panicked": { pattern: /i panicked|freaked out|got nervous/gi, sentiment: "hesitant" },
        "Good call": { pattern: /good call|nice|that was smart|big brain/gi, sentiment: "confident" },
        "Bad decision": { pattern: /bad decision|shouldn't have|that was dumb/gi, sentiment: "analytical" },
      };

      const phraseResults = new Map<string, ReasoningPhrase>();

      voiceNotes?.forEach(note => {
        const text = note.transcription || "";
        Object.entries(phrasePatterns).forEach(([phrase, config]) => {
          const matches = text.match(config.pattern);
          if (matches) {
            const existing = phraseResults.get(phrase) || {
              phrase,
              count: 0,
              sentiment: config.sentiment,
              examples: [],
            };
            existing.count += matches.length;
            if (existing.examples.length < 3 && text.length < 200) {
              existing.examples.push(text);
            }
            phraseResults.set(phrase, existing);
          }
        });
      });

      setReasoningPhrases(
        Array.from(phraseResults.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
      );

    } catch (error) {
      console.error("Error loading insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const maxActivityCount = useMemo(() => 
    Math.max(...sessionActivity.map(a => a.count), 1),
    [sessionActivity]
  );

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Analysis</p>
            <h1 className="font-display text-4xl lg:text-5xl tracking-wide text-foreground">
              BEHAVIORAL INSIGHTS
            </h1>
          </div>

          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-36 uppercase text-xs tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d" className="uppercase text-xs">Last 7 days</SelectItem>
              <SelectItem value="30d" className="uppercase text-xs">Last 30 days</SelectItem>
              <SelectItem value="90d" className="uppercase text-xs">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Card className="p-6 border-border/30 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Sessions Reviewed</p>
                <p className="font-display text-5xl text-foreground">{totalSessions}</p>
              </div>
              <div className="p-2 rounded bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/30 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Review Time</p>
                <p className="font-display text-5xl text-foreground">{formatDuration(totalReviewTime).toUpperCase()}</p>
              </div>
              <div className="p-2 rounded bg-vantage-teal/10">
                <Clock className="h-5 w-5 text-vantage-teal" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/30 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Patterns Found</p>
                <p className="font-display text-5xl text-foreground">{patterns.length}</p>
              </div>
              <div className="p-2 rounded bg-vantage-success/10">
                <Target className="h-5 w-5 text-vantage-success" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Session Activity Heatmap */}
          <Card className="p-5 border-border/30">
            <h3 className="font-display text-xl tracking-wide mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              REVIEW ACTIVITY
            </h3>
            
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {sessionActivity.slice(-42).map((day, i) => (
                  <div
                    key={day.date}
                    className={cn(
                      "w-4 h-4 rounded-sm transition-colors",
                      day.count === 0 && "bg-muted",
                      day.count === 1 && "bg-primary/30",
                      day.count === 2 && "bg-primary/50",
                      day.count >= 3 && "bg-primary"
                    )}
                    title={`${format(new Date(day.date), "MMM d")}: ${day.count} sessions`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-sm bg-muted" />
                  <div className="w-3 h-3 rounded-sm bg-primary/30" />
                  <div className="w-3 h-3 rounded-sm bg-primary/50" />
                  <div className="w-3 h-3 rounded-sm bg-primary" />
                </div>
                <span>More</span>
              </div>
            </div>
          </Card>

          {/* Common Tags */}
          <Card className="p-5 border-border/30">
            <h3 className="font-display text-xl tracking-wide mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-vantage-warning" />
              BEHAVIORAL TAGS
            </h3>
            
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {tagInsights.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tags recorded yet. Add tags to annotations to see patterns.
                  </p>
                ) : (
                  tagInsights.map((tag) => (
                    <div
                      key={tag.tag}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            tag.category === "mistake" && "border-destructive/50 text-destructive",
                            tag.category === "strength" && "border-vantage-success/50 text-vantage-success"
                          )}
                        >
                          {tag.tag}
                        </Badge>
                        <span className="text-sm text-muted-foreground">×{tag.count}</span>
                      </div>
                      {tag.recentTrend !== 0 && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs",
                          tag.recentTrend > 0 
                            ? tag.category === "mistake" ? "text-destructive" : "text-vantage-success"
                            : tag.category === "mistake" ? "text-vantage-success" : "text-destructive"
                        )}>
                          {tag.recentTrend > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.abs(tag.recentTrend)}%
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* AI-Detected Patterns */}
          <Card className="p-5 lg:col-span-2 border-border/30">
            <h3 className="font-display text-xl tracking-wide mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              RECURRING PATTERNS
            </h3>
            
            {patterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No patterns detected yet</p>
                <p className="text-xs">Run Coach review on your sessions to identify behavioral patterns</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {patterns.map((pattern, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border",
                      pattern.impact === "positive" && "border-vantage-success/30 bg-vantage-success/5",
                      pattern.impact === "negative" && "border-destructive/30 bg-destructive/5",
                      pattern.impact === "neutral" && "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {pattern.impact === "positive" ? (
                          <Shield className="h-4 w-4 text-vantage-success" />
                        ) : pattern.impact === "negative" ? (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">{pattern.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {pattern.frequency}× seen
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {pattern.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>Across {pattern.sessions.length} sessions</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Reasoning Language */}
          <Card className="p-5 lg:col-span-2 border-border/30">
            <h3 className="font-display text-xl tracking-wide mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-vantage-teal" />
              DECISION LANGUAGE
            </h3>
            <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">
              Common phrases from voice notes revealing decision-making tendencies
            </p>
            
            {reasoningPhrases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No voice notes analyzed yet</p>
                <p className="text-xs">Record voice annotations to see your reasoning language patterns</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {reasoningPhrases.map((phrase, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-3 rounded-lg border",
                      phrase.sentiment === "confident" && "border-vantage-success/30 bg-vantage-success/5",
                      phrase.sentiment === "hesitant" && "border-vantage-warning/30 bg-vantage-warning/5",
                      phrase.sentiment === "frustrated" && "border-destructive/30 bg-destructive/5",
                      phrase.sentiment === "analytical" && "border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {phrase.sentiment === "confident" ? (
                          <Shield className="h-4 w-4 text-vantage-success" />
                        ) : phrase.sentiment === "hesitant" ? (
                          <AlertTriangle className="h-4 w-4 text-vantage-warning" />
                        ) : phrase.sentiment === "frustrated" ? (
                          <Flame className="h-4 w-4 text-destructive" />
                        ) : (
                          <Lightbulb className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-mono text-sm">"{phrase.phrase}"</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {phrase.count}×
                      </Badge>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        phrase.sentiment === "confident" && "text-vantage-success border-vantage-success/50",
                        phrase.sentiment === "hesitant" && "text-vantage-warning border-vantage-warning/50",
                        phrase.sentiment === "frustrated" && "text-destructive border-destructive/50",
                        phrase.sentiment === "analytical" && "text-primary border-primary/50"
                      )}
                    >
                      {phrase.sentiment}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Insight summary */}
        <Card className="mt-10 p-6 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded bg-primary/20">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-display text-xl tracking-wide mb-2">INSIGHT SUMMARY</h4>
              <p className="text-sm text-muted-foreground">
                {totalSessions === 0 ? (
                  "Start reviewing sessions to build your behavioral profile. The more you annotate and analyze, the more patterns we can identify."
                ) : patterns.length === 0 ? (
                  `You've reviewed ${totalSessions} sessions. Run AI analysis on them to identify behavioral patterns and decision-making trends.`
                ) : (
                  `Based on ${totalSessions} sessions and ${patterns.length} identified patterns, focus on ${
                    patterns.filter(p => p.impact === "negative").length > 0 
                      ? `reducing "${patterns.find(p => p.impact === "negative")?.name}" occurrences`
                      : "maintaining your current decision-making approach"
                  }. Your voice notes show ${
                    reasoningPhrases[0]?.sentiment === "analytical" 
                      ? "strong analytical thinking"
                      : reasoningPhrases[0]?.sentiment === "confident"
                        ? "confident decision-making"
                        : "room for more decisive callouts"
                  }.`
                )}
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
