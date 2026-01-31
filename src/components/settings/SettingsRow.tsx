import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, Pencil, Loader2 } from "lucide-react";

interface SettingsRowProps {
  label: string;
  value: string;
  placeholder?: string;
  description?: string;
  editable?: boolean;
  type?: "text" | "email" | "password";
  onSave?: (value: string) => Promise<void>;
  validate?: (value: string) => string | null;
  disabled?: boolean;
}

export function SettingsRow({
  label,
  value,
  placeholder,
  description,
  editable = true,
  type = "text",
  onSave,
  validate,
  disabled = false,
}: SettingsRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = () => {
    setEditValue(value);
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(value);
    setError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (validate) {
      const validationError = validate(editValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (!onSave) return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div className="py-3 sm:py-4 border-b border-border/20 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <div className="sm:w-1/3 shrink-0">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type={type}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={isSaving}
                  className={cn(
                    "flex-1",
                    error && "border-destructive focus-visible:ring-destructive"
                  )}
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="shrink-0 h-10 w-10 text-primary hover:text-primary hover:bg-primary/10"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="shrink-0 h-10 w-10 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <span className={cn(
                "text-sm truncate",
                value ? "text-foreground" : "text-muted-foreground italic"
              )}>
                {value || placeholder || "Not set"}
              </span>
              {editable && !disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
