import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2, Phone, ArrowLeft } from "lucide-react";

interface PhoneSignInProps {
  onSuccess: () => void;
  disabled?: boolean;
}

export function PhoneSignIn({ onSuccess, disabled }: PhoneSignInProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    // Ensure phone has country code
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) throw error;

      toast.success("Verification code sent!");
      setStep("otp");
    } catch (error: any) {
      console.error("Send OTP error:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: "sms",
      });

      if (error) throw error;

      toast.success("Welcome!");
      onSuccess();
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      toast.error(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("phone");
    setOtp("");
  };

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
        
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Verification Code
          </Label>
          <p className="text-sm text-muted-foreground mb-3">
            Enter the 6-digit code sent to {phone}
          </p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="bg-muted/30 border-border/50" />
                <InputOTPSlot index={1} className="bg-muted/30 border-border/50" />
                <InputOTPSlot index={2} className="bg-muted/30 border-border/50" />
                <InputOTPSlot index={3} className="bg-muted/30 border-border/50" />
                <InputOTPSlot index={4} className="bg-muted/30 border-border/50" />
                <InputOTPSlot index={5} className="bg-muted/30 border-border/50" />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleVerifyOtp}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider h-11"
          disabled={loading || otp.length !== 6}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify & Sign In"
          )}
        </Button>

        <button
          type="button"
          onClick={handleSendOtp}
          className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          disabled={loading}
        >
          Resend code
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">
          Phone Number
        </Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading || disabled}
          className="bg-muted/30 border-border/50 focus:border-primary h-11"
        />
        <p className="text-xs text-muted-foreground">
          Include country code (e.g., +1 for US)
        </p>
      </div>

      <Button
        type="button"
        onClick={handleSendOtp}
        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider h-11"
        disabled={loading || disabled || !phone.trim()}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending code...
          </>
        ) : (
          <>
            <Phone className="mr-2 h-4 w-4" />
            Continue with Phone
          </>
        )}
      </Button>
    </div>
  );
}
