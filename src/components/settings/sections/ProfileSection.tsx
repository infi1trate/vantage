import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { SettingsRow } from "../SettingsRow";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export function ProfileSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
      } else {
        // Create profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({ 
            user_id: user.id, 
            display_name: user.email?.split("@")[0] 
          })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (field: keyof Profile, value: string) => {
    if (!user || !profile) return;

    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value })
      .eq("user_id", user.id);

    if (error) throw error;

    setProfile((prev) => prev ? { ...prev, [field]: value } : null);
    toast.success("Profile updated");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      // Upload to storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("session-thumbnails")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("session-thumbnails")
        .getPublicUrl(filePath);

      // Update profile
      await updateProfile("avatar_url", urlData.publicUrl);
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const validateUsername = (value: string): string | null => {
    if (!value) return null; // Allow empty
    if (value.length < 3) return "Username must be at least 3 characters";
    if (value.length > 30) return "Username must be less than 30 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Only letters, numbers, and underscores allowed";
    return null;
  };

  const validateDisplayName = (value: string): string | null => {
    if (value.length > 50) return "Display name must be less than 50 characters";
    return null;
  };

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  const userInitial = profile?.display_name?.charAt(0).toUpperCase() || 
                      user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="space-y-6">
      <SettingsCard title="Profile Picture" description="Your public avatar">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-2xl">
                {userInitial}
              </AvatarFallback>
            </Avatar>
            <label
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="sr-only"
              />
            </label>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              Click to upload a new photo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG or GIF. Max 2MB.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Profile Information" description="Your public identity on Vantage">
        <SettingsRow
          label="Display Name"
          value={profile?.display_name || ""}
          placeholder="Enter your display name"
          description="Shown on your profile and comments"
          onSave={(value) => updateProfile("display_name", value)}
          validate={validateDisplayName}
        />
        <SettingsRow
          label="Username"
          value={profile?.username || ""}
          placeholder="Enter a username"
          description="Your unique @handle"
          onSave={(value) => updateProfile("username", value)}
          validate={validateUsername}
        />
      </SettingsCard>
    </div>
  );
}
