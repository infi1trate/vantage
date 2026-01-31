/**
 * Camera Section - Default Camera Settings
 * 
 * QA Checklist:
 * - If device enumeration fails, default to "Use last selected device"
 * - Handle slow network with inline spinners on save buttons
 * - Proper toast messages: "Camera defaults saved."
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { SettingsCard, SettingsCardSkeleton } from "../SettingsCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
}

export function CameraSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingCamera, setSavingCamera] = useState(false);
  const [savingQuality, setSavingQuality] = useState(false);

  // Camera device state
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [canEnumerateDevices, setCanEnumerateDevices] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("last-selected");
  const [mirrorPreview, setMirrorPreview] = useState(true);

  // Quality state
  const [resolution, setResolution] = useState<string>("auto");
  const [fps, setFps] = useState<string>("auto");

  // Original values for change detection
  const [originalCamera, setOriginalCamera] = useState({ device: "last-selected", mirror: true });
  const [originalQuality, setOriginalQuality] = useState({ resolution: "auto", fps: "auto" });

  useEffect(() => {
    if (user) {
      fetchPreferences();
      enumerateCameras();
    }
  }, [user]);

  const enumerateCameras = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setCanEnumerateDevices(false);
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
        }));

      if (videoDevices.length > 0 && videoDevices[0].label) {
        setCameraDevices(videoDevices);
        setCanEnumerateDevices(true);
      } else {
        setCanEnumerateDevices(false);
      }
    } catch (error) {
      console.error("Error enumerating cameras:", error);
      setCanEnumerateDevices(false);
    }
  };

  const fetchPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("camera_device_id, camera_mirror, camera_resolution, camera_fps")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const deviceVal = data.camera_device_id || "last-selected";
        const mirrorVal = data.camera_mirror ?? true;
        const resVal = data.camera_resolution || "auto";
        const fpsVal = data.camera_fps || "auto";

        setSelectedDevice(deviceVal);
        setMirrorPreview(mirrorVal);
        setResolution(resVal);
        setFps(fpsVal);

        setOriginalCamera({ device: deviceVal, mirror: mirrorVal });
        setOriginalQuality({ resolution: resVal, fps: fpsVal });
      } else {
        await supabase.from("user_preferences").insert({ user_id: user.id });
      }
    } catch (error) {
      console.error("Error fetching camera preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCamera = async () => {
    if (!user) return;

    setSavingCamera(true);
    try {
      const deviceId = selectedDevice === "last-selected" || selectedDevice === "choose-at-capture" 
        ? null 
        : selectedDevice;

      const { error } = await supabase
        .from("user_preferences")
        .update({
          camera_device_id: deviceId,
          camera_mirror: mirrorPreview,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setOriginalCamera({ device: selectedDevice, mirror: mirrorPreview });
      toast.success("Camera settings saved.");
    } catch (error) {
      console.error("Error saving camera settings:", error);
      toast.error("Failed to save camera settings");
    } finally {
      setSavingCamera(false);
    }
  };

  const handleSaveQuality = async () => {
    if (!user) return;

    setSavingQuality(true);
    try {
      const { error } = await supabase
        .from("user_preferences")
        .update({
          camera_resolution: resolution,
          camera_fps: fps,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setOriginalQuality({ resolution, fps });
      toast.success("Quality settings saved.");
    } catch (error) {
      console.error("Error saving quality settings:", error);
      toast.error("Failed to save quality settings");
    } finally {
      setSavingQuality(false);
    }
  };

  const hasCameraChanges = selectedDevice !== originalCamera.device || mirrorPreview !== originalCamera.mirror;
  const hasQualityChanges = resolution !== originalQuality.resolution || fps !== originalQuality.fps;

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
      {/* Default Camera Card */}
      <SettingsCard 
        title="Default camera" 
        description="Choose which camera Vantage uses by default during capture."
      >
        <div className="space-y-5">
          {/* Camera Device Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="camera-device" className="text-sm font-medium text-foreground">
              Preferred camera device
            </Label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger id="camera-device" className="w-full bg-background">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                {canEnumerateDevices ? (
                  <>
                    {cameraDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="choose-at-capture">Choose at capture time</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="last-selected">Use last selected device</SelectItem>
                    <SelectItem value="choose-at-capture">Choose at capture time</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {!canEnumerateDevices && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
                Camera access required to show available devices.
              </p>
            )}
          </div>

          {/* Mirror Toggle */}
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <Label htmlFor="mirror-preview" className="text-sm font-medium text-foreground">
                Mirror selfie preview
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Flip your camera preview like a mirror
              </p>
            </div>
            <Switch
              id="mirror-preview"
              checked={mirrorPreview}
              onCheckedChange={setMirrorPreview}
              aria-describedby="mirror-preview-desc"
            />
          </div>
          <span id="mirror-preview-desc" className="sr-only">
            When enabled, your camera preview will be flipped horizontally like a mirror
          </span>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSaveCamera}
              disabled={!hasCameraChanges || savingCamera}
            >
              {savingCamera ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </SettingsCard>

      {/* Quality Card */}
      <SettingsCard 
        title="Camera quality" 
        description="Balance clarity and performance."
      >
        <div className="space-y-5">
          {/* Resolution Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="camera-resolution" className="text-sm font-medium text-foreground">
              Resolution
            </Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger id="camera-resolution" className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                <SelectItem value="auto">Auto (recommended)</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Frame Rate Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="camera-fps" className="text-sm font-medium text-foreground">
              Frame rate
            </Label>
            <Select value={fps} onValueChange={setFps}>
              <SelectTrigger id="camera-fps" className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border z-50">
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">
                  <span className="flex items-center gap-2">
                    60 fps
                    <span className="text-xs text-muted-foreground">(uses more CPU)</span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Microcopy */}
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3 w-3 shrink-0 mt-0.5" aria-hidden="true" />
            Auto adapts based on your device and current load.
          </p>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSaveQuality}
              disabled={!hasQualityChanges || savingQuality}
            >
              {savingQuality ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
