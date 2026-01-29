import { useState, useEffect } from "react";
import { CaptureSession } from "@/lib/captures";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Monitor, 
  Mic, 
  Video, 
  Volume2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";

interface CaptureSetupProps {
  session: CaptureSession;
  onStart: (config: { enableFacecam: boolean; enableSystemAudio: boolean }) => void;
  isLoading: boolean;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

export function CaptureSetup({ session, onStart, isLoading }: CaptureSetupProps) {
  const [enableFacecam, setEnableFacecam] = useState(false);
  const [enableSystemAudio, setEnableSystemAudio] = useState(true);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<{
    microphone: "unknown" | "granted" | "denied" | "prompt";
    camera: "unknown" | "granted" | "denied" | "prompt";
  }>({
    microphone: "unknown",
    camera: "unknown",
  });

  useEffect(() => {
    loadDevices();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Check microphone permission
      const micPermission = await navigator.permissions.query({ name: "microphone" as PermissionName });
      setPermissionStatus(prev => ({ ...prev, microphone: micPermission.state }));
      
      micPermission.addEventListener("change", () => {
        setPermissionStatus(prev => ({ ...prev, microphone: micPermission.state }));
      });

      // Check camera permission
      const cameraPermission = await navigator.permissions.query({ name: "camera" as PermissionName });
      setPermissionStatus(prev => ({ ...prev, camera: cameraPermission.state }));
      
      cameraPermission.addEventListener("change", () => {
        setPermissionStatus(prev => ({ ...prev, camera: cameraPermission.state }));
      });
    } catch (err) {
      // Permission API not supported, will request when needed
      console.log("Permission API not fully supported");
    }
  };

  const loadDevices = async () => {
    setLoadingDevices(true);
    try {
      // Request permissions to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const mics = devices
        .filter(d => d.kind === "audioinput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      
      const cams = devices
        .filter(d => d.kind === "videoinput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
      
      setMicrophones(mics);
      setCameras(cams);
      
      if (mics.length > 0) setSelectedMic(mics[0].deviceId);
      if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
      
      setPermissionStatus({ microphone: "granted", camera: "granted" });
    } catch (err: any) {
      console.error("Error loading devices:", err);
      if (err.name === "NotAllowedError") {
        // Try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach(track => track.stop());
          
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices
            .filter(d => d.kind === "audioinput")
            .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
          
          setMicrophones(mics);
          if (mics.length > 0) setSelectedMic(mics[0].deviceId);
          
          setPermissionStatus(prev => ({ ...prev, microphone: "granted" }));
        } catch {
          setPermissionStatus({ microphone: "denied", camera: "denied" });
        }
      }
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleStart = () => {
    onStart({
      enableFacecam,
      enableSystemAudio,
    });
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case "granted":
        return <CheckCircle className="h-4 w-4 text-vantage-success" />;
      case "denied":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="p-6 bg-card border-border/50">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Capture Setup</h2>
          <p className="text-muted-foreground">
            Configure your capture settings for <span className="text-foreground font-medium">{session.title}</span>
          </p>
        </div>

        {/* Permission Status */}
        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
          <h3 className="text-sm font-medium mb-3">Permission Status</h3>
          <div className="flex items-center gap-2 text-sm">
            {getPermissionIcon(permissionStatus.microphone)}
            <span>Microphone: {permissionStatus.microphone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {getPermissionIcon(permissionStatus.camera)}
            <span>Camera: {permissionStatus.camera}</span>
          </div>
        </div>

        {/* Required: Screen Capture */}
        <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Monitor className="h-6 w-6 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Screen Capture</h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your game window when prompted. The browser will ask you to choose which screen or window to share.
            </p>
          </div>
        </div>

        {/* Required: Microphone */}
        <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Mic className="h-6 w-6 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">Microphone</h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Your voice will be recorded for annotations and commentary.
            </p>
            {loadingDevices ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading devices...
              </div>
            ) : microphones.length > 0 ? (
              <Select value={selectedMic} onValueChange={setSelectedMic}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select microphone" />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map(mic => (
                    <SelectItem key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-destructive">No microphones found. Please connect a microphone.</p>
            )}
          </div>
        </div>

        {/* Optional: System Audio */}
        <div className="flex items-start gap-4 p-4 border border-border/50 rounded-lg">
          <Volume2 className="h-6 w-6 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">System Audio</h3>
              <Switch
                checked={enableSystemAudio}
                onCheckedChange={setEnableSystemAudio}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Capture game audio along with your screen. You'll need to enable "Share audio" when selecting your screen.
            </p>
          </div>
        </div>

        {/* Optional: Facecam */}
        <div className="flex items-start gap-4 p-4 border border-border/50 rounded-lg">
          <Video className="h-6 w-6 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Facecam</h3>
              <Switch
                checked={enableFacecam}
                onCheckedChange={setEnableFacecam}
              />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Record your webcam as an overlay on your gameplay.
            </p>
            {enableFacecam && (
              loadingDevices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cameras...
                </div>
              ) : cameras.length > 0 ? (
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map(cam => (
                      <SelectItem key={cam.deviceId} value={cam.deviceId}>
                        {cam.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-yellow-500">No cameras found. Facecam will be disabled.</p>
              )
            )}
          </div>
        </div>

        {/* Start Button */}
        <Button
          size="lg"
          onClick={handleStart}
          disabled={isLoading || microphones.length === 0}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Requesting Permissions...
            </>
          ) : (
            "Start Capture"
          )}
        </Button>

        {/* Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Close unnecessary applications to improve capture performance</p>
          <p>• For best results, run your game in borderless windowed mode</p>
          <p>• Make sure to allow all permission prompts from your browser</p>
        </div>
      </div>
    </Card>
  );
}
