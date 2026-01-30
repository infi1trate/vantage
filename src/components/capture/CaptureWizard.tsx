import { useState, useEffect } from "react";
import { CaptureSession } from "@/lib/captures";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Circle
} from "lucide-react";

interface CaptureWizardProps {
  session: CaptureSession;
  onStart: (config: { enableFacecam: boolean; enableSystemAudio: boolean }) => void;
  isLoading: boolean;
}

interface DeviceInfo {
  deviceId: string;
  label: string;
}

type WizardStep = "screen" | "mic" | "cam" | "summary";

const STEPS: WizardStep[] = ["screen", "mic", "cam", "summary"];

export function CaptureWizard({ session, onStart, isLoading }: CaptureWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("screen");
  const [enableMic, setEnableMic] = useState(true);
  const [enableFacecam, setEnableFacecam] = useState(false);
  const [enableSystemAudio, setEnableSystemAudio] = useState(true);
  
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>("");
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

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
        } catch {
          // Permissions denied
        }
      }
    } finally {
      setLoadingDevices(false);
    }
  };

  const currentStepIndex = STEPS.indexOf(currentStep);
  
  const canProceed = () => {
    switch (currentStep) {
      case "screen":
        return true; // Just informational
      case "mic":
        return enableMic && microphones.length > 0 && selectedMic;
      case "cam":
        return true; // Optional
      case "summary":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleConfigure = () => {
    onStart({
      enableFacecam,
      enableSystemAudio,
    });
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((step, index) => (
        <div key={step} className="flex items-center">
          <button
            onClick={() => index <= currentStepIndex && setCurrentStep(step)}
            disabled={index > currentStepIndex}
            className={`
              w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${index === currentStepIndex 
                ? "bg-primary text-primary-foreground" 
                : index < currentStepIndex 
                  ? "bg-vantage-success text-white cursor-pointer hover:bg-vantage-success/80" 
                  : "bg-muted text-muted-foreground"
              }
            `}
          >
            {index < currentStepIndex ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </button>
          {index < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${index < currentStepIndex ? "bg-vantage-success" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="p-6 bg-card border-border/30">
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl tracking-wide mb-2">CAPTURE SETUP</h2>
          <p className="text-muted-foreground text-sm">
            Configure your capture for <span className="text-foreground font-medium">{session.title}</span>
          </p>
        </div>

        <StepIndicator />

        {/* Step 1: Screen Selection */}
        {currentStep === "screen" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Step 1: Choose Screen Source</h3>
                <p className="text-sm text-muted-foreground">Select what you want to capture</p>
              </div>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <p className="text-sm text-foreground">
                You'll be prompted to choose from:
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-background rounded border border-border text-center">
                  <Monitor className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <span className="text-xs font-medium">Entire Screen</span>
                </div>
                <div className="p-3 bg-background rounded border border-border text-center">
                  <Monitor className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <span className="text-xs font-medium">Window</span>
                </div>
                <div className="p-3 bg-background rounded border border-border text-center">
                  <Monitor className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <span className="text-xs font-medium">Browser Tab</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded text-xs text-muted-foreground">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Tip:</strong> Sharing a browser tab can include tab audio. 
                  Sharing a window often cannot.
                </p>
              </div>
            </div>

            {/* System Audio Toggle */}
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Include System Audio</span>
                <Badge variant="outline" className="text-[10px]">Optional</Badge>
              </div>
              <Switch
                checked={enableSystemAudio}
                onCheckedChange={setEnableSystemAudio}
              />
            </div>
          </div>
        )}

        {/* Step 2: Microphone */}
        {currentStep === "mic" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Step 2: Microphone</h3>
                <p className="text-sm text-muted-foreground">Your voice is required for VANTAGE</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-3">
                <Mic className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-sm font-medium">Enable Microphone</span>
                  <Badge className="ml-2 bg-primary/20 text-primary text-[10px]">Required</Badge>
                </div>
              </div>
              <Switch
                checked={enableMic}
                onCheckedChange={setEnableMic}
                disabled // Always required
              />
            </div>

            {loadingDevices ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading microphones...
              </div>
            ) : microphones.length > 0 ? (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Select Microphone
                </label>
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
              </div>
            ) : (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">No microphones found</span>
                </div>
                <p className="text-xs text-destructive/80 mt-1">
                  Please connect a microphone to continue.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Camera */}
        {currentStep === "cam" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Step 3: Webcam</h3>
                <p className="text-sm text-muted-foreground">Add a facecam overlay (optional)</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Video className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Enable Facecam</span>
                  <Badge variant="outline" className="ml-2 text-[10px]">Optional</Badge>
                </div>
              </div>
              <Switch
                checked={enableFacecam}
                onCheckedChange={setEnableFacecam}
              />
            </div>

            {enableFacecam && (
              loadingDevices ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cameras...
                </div>
              ) : cameras.length > 0 ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Select Camera
                  </label>
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
                </div>
              ) : (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">No cameras found</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Facecam will be disabled. You can continue without it.
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* Step 4: Summary */}
        {currentStep === "summary" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-vantage-success/20 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-vantage-success" />
              </div>
              <div>
                <h3 className="font-medium text-lg">Step 4: Confirm Setup</h3>
                <p className="text-sm text-muted-foreground">Review your capture settings</p>
              </div>
            </div>

            <div className="p-4 bg-vantage-success/10 border border-vantage-success/30 rounded-lg space-y-3">
              <h4 className="text-sm font-medium text-vantage-success uppercase tracking-wider">
                You are about to record:
              </h4>
              
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-vantage-success" />
                  <span>Screen video</span>
                  {enableSystemAudio && (
                    <span className="text-muted-foreground">+ System audio</span>
                  )}
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-vantage-success" />
                  <span>Microphone audio</span>
                  <span className="text-xs text-muted-foreground">
                    ({microphones.find(m => m.deviceId === selectedMic)?.label || "Default"})
                  </span>
                </li>
                {enableFacecam && cameras.length > 0 && (
                  <li className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-vantage-success" />
                    <span>Webcam video</span>
                    <span className="text-xs text-muted-foreground">
                      ({cameras.find(c => c.deviceId === selectedCamera)?.label || "Default"})
                    </span>
                  </li>
                )}
              </ul>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
              <p>• Browser will prompt you to select your screen/window/tab</p>
              <p>• Close unnecessary applications for better performance</p>
              <p>• Press <kbd className="px-1 py-0.5 bg-muted rounded font-mono">Space</kbd> to pause/resume during recording</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || isLoading}
            className="uppercase tracking-wider text-xs"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep === "summary" ? (
            <Button
              size="lg"
              onClick={handleConfigure}
              disabled={!canProceed() || isLoading}
              className="uppercase tracking-wider font-bold min-w-40"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Acquiring...
                </>
              ) : (
                <>
                  <Circle className="mr-2 h-4 w-4" fill="currentColor" />
                  Configure & Preview
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="uppercase tracking-wider text-xs"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
