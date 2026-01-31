import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [lastChanged, setLastChanged] = useState<Date | null>(null);

  const validateNewPassword = (value: string): string | null => {
    if (!value) return null;
    if (value.length < 8) return "Password must be at least 8 characters";
    return null;
  };

  const validateConfirmPassword = (value: string): string | null => {
    if (!value) return null;
    if (value !== newPassword) return "Passwords do not match";
    return null;
  };

  const handleCurrentPasswordChange = (value: string) => {
    setCurrentPassword(value);
    setCurrentPasswordError(null);
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    setNewPasswordError(validateNewPassword(value));
    if (confirmPassword) {
      setConfirmPasswordError(value !== confirmPassword ? "Passwords do not match" : null);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmPasswordError(validateConfirmPassword(value));
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      setCurrentPasswordError("Current password is required");
      return;
    }

    if (!newPassword) {
      setNewPasswordError("New password is required");
      return;
    }

    if (newPassword.length < 8) {
      setNewPasswordError("Password must be at least 8 characters");
      return;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      return;
    }

    setSaving(true);
    setCurrentPasswordError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("Unable to verify user");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setCurrentPasswordError("Incorrect password");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLastChanged(new Date());
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const formatLastChanged = () => {
    if (!lastChanged) return "—";
    return lastChanged.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const canSubmit = currentPassword && newPassword && confirmPassword && 
                    newPassword.length >= 8 && newPassword === confirmPassword;

  return (
    <div className="space-y-6">
      <SettingsCard 
        title="Password" 
        description="Use a strong password to protect your account."
      >
        <div className="space-y-5">
          <div className="text-sm text-muted-foreground">
            Last changed: {formatLastChanged()}
          </div>

          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-sm font-medium text-foreground">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => handleCurrentPasswordChange(e.target.value)}
                placeholder="Enter current password"
                className={cn(
                  "pr-10",
                  currentPasswordError && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {currentPasswordError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {currentPasswordError}
              </p>
            )}
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => handleNewPasswordChange(e.target.value)}
                placeholder="Enter new password"
                className={cn(
                  "pr-10",
                  newPasswordError && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {newPasswordError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {newPasswordError}
              </p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                placeholder="Confirm new password"
                className={cn(
                  "pr-10",
                  confirmPasswordError && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPasswordError && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {confirmPasswordError}
              </p>
            )}
          </div>

          {/* Password rules helper */}
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Info className="h-3 w-3 shrink-0" />
              At least 10 characters recommended.
            </p>
            <p className="flex items-center gap-1.5">
              <Info className="h-3 w-3 shrink-0" />
              Use a mix of letters, numbers, and symbols.
            </p>
          </div>

          {/* Submit button */}
          <div className="pt-2">
            <Button
              onClick={handleUpdatePassword}
              disabled={!canSubmit || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </div>

          {/* Security note */}
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/30">
            If you didn't request this change, revoke active sessions below.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
