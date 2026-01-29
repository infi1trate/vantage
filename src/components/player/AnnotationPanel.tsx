import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Annotation, createAnnotation } from "@/lib/captures";
import { TagSelector } from "./TagSelector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Target, 
  Skull, 
  Star, 
  Flag, 
  MessageSquare, 
  Bookmark,
  ChevronDown,
  Trash2,
  X,
  Tag
} from "lucide-react";
import { toast } from "sonner";

interface AnnotationPanelProps {
  sessionId: string;
  currentTime: number;
  annotations: Annotation[];
  onAnnotationCreated: (annotation: Annotation) => void;
  onAnnotationClick: (annotation: Annotation) => void;
  onAnnotationDelete?: (annotationId: string) => void;
}

const ANNOTATION_TYPES = [
  { type: "marker" as const, label: "Marker", icon: Bookmark, color: "text-primary" },
  { type: "kill" as const, label: "Kill", icon: Target, color: "text-red-500" },
  { type: "death" as const, label: "Death", icon: Skull, color: "text-vantage-purple" },
  { type: "highlight" as const, label: "Highlight", icon: Star, color: "text-yellow-500" },
  { type: "objective" as const, label: "Objective", icon: Flag, color: "text-vantage-success" },
  { type: "note" as const, label: "Note", icon: MessageSquare, color: "text-muted-foreground" },
];

export function AnnotationPanel({
  sessionId,
  currentTime,
  annotations,
  onAnnotationCreated,
  onAnnotationClick,
  onAnnotationDelete,
}: AnnotationPanelProps) {
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedType, setSelectedType] = useState<Annotation["annotation_type"]>("marker");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleQuickAdd = async (type: Annotation["annotation_type"]) => {
    if (!user) return;

    try {
      const annotation = await createAnnotation(
        sessionId,
        user.id,
        currentTime,
        type
      );
      onAnnotationCreated(annotation);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} marker added`);
    } catch (error) {
      console.error("Error creating annotation:", error);
      toast.error("Failed to create annotation");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const annotation = await createAnnotation(
        sessionId,
        user.id,
        currentTime,
        selectedType,
        title || undefined,
        content || undefined,
        tags.length > 0 ? tags : undefined
      );
      onAnnotationCreated(annotation);
      toast.success("Annotation added");
      setShowAddForm(false);
      setTitle("");
      setContent("");
      setTags([]);
    } catch (error) {
      console.error("Error creating annotation:", error);
      toast.error("Failed to create annotation");
    } finally {
      setLoading(false);
    }
  };

  const getTypeConfig = (type: Annotation["annotation_type"]) => {
    return ANNOTATION_TYPES.find(t => t.type === type) || ANNOTATION_TYPES[0];
  };

  return (
    <Card className="flex flex-col h-full bg-card border-border/50">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Annotations</h3>
          <span className="text-xs text-muted-foreground font-mono-data">
            @ {formatTime(currentTime)}
          </span>
        </div>

        {/* Quick add buttons */}
        <div className="flex flex-wrap gap-2">
          {ANNOTATION_TYPES.slice(0, 4).map((typeConfig) => (
            <Button
              key={typeConfig.type}
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => handleQuickAdd(typeConfig.type)}
            >
              <typeConfig.icon className={`h-3 w-3 mr-1 ${typeConfig.color}`} />
              {typeConfig.label}
            </Button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Plus className="h-3 w-3 mr-1" />
                More
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ANNOTATION_TYPES.slice(4).map((typeConfig) => (
                <DropdownMenuItem 
                  key={typeConfig.type}
                  onClick={() => handleQuickAdd(typeConfig.type)}
                >
                  <typeConfig.icon className={`h-4 w-4 mr-2 ${typeConfig.color}`} />
                  {typeConfig.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setShowAddForm(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add with note...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 border-b border-border/50 bg-muted/30">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New annotation @ {formatTime(currentTime)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowAddForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex gap-2">
              {ANNOTATION_TYPES.map((typeConfig) => (
                <Button
                  key={typeConfig.type}
                  type="button"
                  variant={selectedType === typeConfig.type ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setSelectedType(typeConfig.type)}
                >
                  <typeConfig.icon className={`h-3 w-3 ${selectedType === typeConfig.type ? "" : typeConfig.color}`} />
                </Button>
              ))}
            </div>

            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background"
            />
            <Textarea
              placeholder="Notes (optional)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="bg-background resize-none"
              rows={2}
            />
            
            {/* Tag selector */}
            <div className="pt-1">
              <TagSelector
                selectedTags={tags}
                onTagsChange={setTags}
              />
            </div>

            <Button type="submit" size="sm" disabled={loading} className="w-full">
              Add Annotation
            </Button>
          </form>
        </div>
      )}

      {/* Annotations list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {annotations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No annotations yet</p>
              <p className="text-xs">Click markers above to add</p>
            </div>
          ) : (
            <div className="space-y-1">
              {annotations.map((annotation) => {
                const config = getTypeConfig(annotation.annotation_type);
                return (
                  <button
                    key={annotation.id}
                    className="w-full p-3 rounded-lg text-left hover:bg-muted/50 transition-colors group"
                    onClick={() => onAnnotationClick(annotation)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded bg-muted`}>
                        <config.icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono-data text-primary">
                            {formatTime(annotation.timestamp_seconds)}
                          </span>
                          <Badge variant="outline" className="text-xs h-5">
                            {config.label}
                          </Badge>
                        </div>
                        {annotation.title && (
                          <p className="text-sm font-medium truncate">
                            {annotation.title}
                          </p>
                        )}
                        {annotation.content && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {annotation.content}
                          </p>
                        )}
                        {annotation.tags && annotation.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {annotation.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs h-4 px-1">
                                {tag}
                              </Badge>
                            ))}
                            {annotation.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                +{annotation.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {onAnnotationDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAnnotationDelete(annotation.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
