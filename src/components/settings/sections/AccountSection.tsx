import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Mail, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
}

export function AccountSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Email form state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [verificationSent, setVerificationSent] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setOriginalDisplayName(data.display_name || "");
      } else {
        // Create profile if it doesn't exist
        const defaultName = user.email?.split("@")[0] || "";
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({ 
            user_id: user.id, 
            display_name: defaultName 
          })
          .select("id, user_id, display_name")
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
        setDisplayName(newProfile.display_name || "");
        setOriginalDisplayName(newProfile.display_name || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  // Profile validation
  const validateDisplayName = (value: string): string | null => {
    if (value.length < 2) return "Display name must be at least 2 characters";
    if (value.length > 32) return "Display name must be 32 characters or less";
    return null;
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setDisplayNameError(validateDisplayName(value));
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    const error = validateDisplayName(displayName);
    if (error) {
      setDisplayNameError(error);
      return;
    }

    setSavingProfile(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: displayName })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setOriginalDisplayName(displayName);
      setProfile((prev) => prev ? { ...prev, display_name: displayName } : null);
      toast.success("Profile updated.");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  // Email validation
  const validateEmail = (value: string): string | null => {
    if (!value) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return "Please enter a valid email address";
    return null;
  };

  const handleNewEmailChange = (value: string) => {
    setNewEmail(value);
    setEmailError(validateEmail(value));
  };

  const handlePasswordChange = (value: string) => {
    setCurrentPassword(value);
    if (!value) {
      setPasswordError("Password is required");
    } else {
      setPasswordError(null);
    }
  };

  const handleStartEditEmail = () => {
    setIsEditingEmail(true);
    setNewEmail("");
    setCurrentPassword("");
    setEmailError(null);
    setPasswordError(null);
    setVerificationSent(null);
  };

  const handleCancelEditEmail = () => {
    setIsEditingEmail(false);
    setNewEmail("");
    setCurrentPassword("");
    setEmailError(null);
    setPasswordError(null);
  };

  const handleUpdateEmail = async () => {
    // Validate email
    const emailValidationError = validateEmail(newEmail);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    // Validate password
    if (!currentPassword) {
      setPasswordError("Password is required");
      return;
    }

    setSavingEmail(true);
    setEmailError(null);
    setPasswordError(null);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError("Incorrect password");
        setSavingEmail(false);
        return;
      }

      // Now update the email
      const { error: updateError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (updateError) {
        // Check for specific error types
        if (updateError.message.includes("already registered") || 
            updateError.message.includes("already in use")) {
          setEmailError("This email is already in use");
        } else {
          setEmailError(updateError.message);
        }
        setSavingEmail(false);
        return;
      }

      // Success - show verification notice
      setVerificationSent(newEmail);
      setIsEditingEmail(false);
      setNewEmail("");
      setCurrentPassword("");
    } catch (error) {
      console.error("Error updating email:", error);
      setEmailError("Failed to update email. Please try again.");
    } finally {
      setSavingEmail(false);
    }
  };

  const hasProfileChanges = displayName !== originalDisplayName;
  const isProfileValid = !displayNameError && displayName.length >= 2 && displayName.length <= 32;

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton />
        <SettingsCardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <SettingsCard 
        title="Profile" 
        description="Update how your name appears across Vantage."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name" className="text-sm font-medium text-foreground">
              Display Name
            </Label>
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              placeholder="Enter your display name"
              className={cn(
                displayNameError && "border-destructive focus-visible:ring-destructive"
              )}
              maxLength={32}
            />
            {displayNameError && (
              <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {displayNameError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {displayName.length}/32 characters
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleSaveProfile}
              disabled={!hasProfileChanges || !isProfileValid || savingProfile}
            >
              {savingProfile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      </SettingsCard>

      {/* Email Card */}
      <SettingsCard 
        title="Email" 
        description="Change the email used to sign in and receive notifications."
      >
        <div className="space-y-4">
          {/* Verification Banner */}
          {verificationSent && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-primary flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Verification sent to <strong>{verificationSent}</strong>. Please verify to complete the change.
                </span>
              </p>
            </div>
          )}

          {!isEditingEmail ? (
            // Read-only view
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground break-all">{user?.email}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditEmail}
                className="shrink-0"
              >
                Edit
              </Button>
            </div>
          ) : (
            // Edit view
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email" className="text-sm font-medium text-foreground">
                  New Email Address
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => handleNewEmailChange(e.target.value)}
                  placeholder="Enter new email address"
                  className={cn(
                    emailError && "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={savingEmail}
                />
                {emailError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm font-medium text-foreground">
                  Current Password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Enter your current password"
                  className={cn(
                    passwordError && "border-destructive focus-visible:ring-destructive"
                  )}
                  disabled={savingEmail}
                />
                {passwordError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {passwordError}
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                We'll send a verification link to your new email.
              </p>

              <div className="flex flex-col xs:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCancelEditEmail}
                  disabled={savingEmail}
                  className="flex-1 xs:flex-none"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateEmail}
                  disabled={savingEmail || !newEmail || !currentPassword}
                  className="flex-1 xs:flex-none"
                >
                  {savingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    "Update email"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
