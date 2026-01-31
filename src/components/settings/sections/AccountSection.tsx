import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountSection() {
  const { user } = useAuth();
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleEmailChange = async () => {
    if (!newEmail) {
      toast.error("Please enter a new email address");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;

      toast.success("Confirmation email sent to your new address");
      setIsChangingEmail(false);
      setNewEmail("");
    } catch (error) {
      console.error("Error updating email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Password updated successfully");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="space-y-6">
      {/* Email Section */}
      <SettingsCard title="Email Address" description="Used for sign-in and notifications">
        {!isChangingEmail ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground break-all">{user?.email}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingEmail(true)}
              className="shrink-0"
            >
              Change Email
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email Address</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
                disabled={emailLoading}
              />
            </div>
            <div className="flex flex-col xs:flex-row gap-2">
              <Button
                onClick={handleEmailChange}
                disabled={emailLoading}
                className="flex-1 xs:flex-none"
              >
                {emailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Send Confirmation
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangingEmail(false);
                  setNewEmail("");
                }}
                disabled={emailLoading}
                className="flex-1 xs:flex-none"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Password Section */}
      <SettingsCard title="Password" description="Update your account password">
        {!isChangingPassword ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">••••••••••••</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangingPassword(true)}
              className="shrink-0"
            >
              Change Password
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={passwordLoading}
              />
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          passwordStrength >= level
                            ? passwordStrength <= 2
                              ? "bg-destructive"
                              : passwordStrength <= 3
                              ? "bg-warning"
                              : "bg-vantage-success"
                            : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {passwordStrength <= 2 ? "Weak" : passwordStrength <= 3 ? "Fair" : passwordStrength <= 4 ? "Good" : "Strong"}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={passwordLoading}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
            </div>
            <div className="flex flex-col xs:flex-row gap-2">
              <Button
                onClick={handlePasswordChange}
                disabled={passwordLoading || newPassword !== confirmPassword}
                className="flex-1 xs:flex-none"
              >
                {passwordLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Update Password
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                disabled={passwordLoading}
                className="flex-1 xs:flex-none"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>

      {/* Danger Zone */}
      <SettingsCard 
        title="Danger Zone" 
        description="Irreversible account actions"
        className="border-destructive/30"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-destructive">Delete Account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all data
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.error("Please contact support to delete your account")}
            className="shrink-0"
          >
            Delete Account
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}
