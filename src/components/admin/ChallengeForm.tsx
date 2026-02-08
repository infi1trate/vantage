/**
 * Challenge Form Component
 * 
 * Shared form for creating and editing challenges.
 * Supports read-only mode and field-level disabling.
 */

import { useMemo, useState, useRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { format, isBefore, isAfter } from "date-fns";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CalendarIcon,
  Flame,
  CheckCircle,
  Sparkles,
  AlertTriangle,
  Lock,
  HelpCircle,
  Upload,
  ImageIcon,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Games list - in production this would come from the database
export const GAMES = [
  "Valorant",
  "Fortnite",
  "Call of Duty: Warzone",
  "Apex Legends",
  "League of Legends",
  "Counter-Strike 2",
  "Rocket League",
  "Overwatch 2",
  "Marvel Rivals",
  "Other",
];

// Form schema with validation
export const challengeFormSchema = z.object({
  // Basics
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  game: z.string().min(1, "Please select a game"),
  difficulty: z.number().min(1).max(5),
  heroMediaUrl: z.string().url().optional().or(z.literal("")),
  
  // Rules
  rulesSummary: z.string().min(10, "Summary must be at least 10 characters").max(200),
  rulesFull: z.string().min(20, "Full rules must be at least 20 characters"),
  
  // Timing
  startAt: z.date({ required_error: "Start date is required" }),
  endAt: z.date({ required_error: "End date is required" }),
  
  // Clip requirements
  minDurationSeconds: z.number().min(1).max(300).default(6),
  maxDurationSeconds: z.number().min(1).max(300).default(30),
  
  // Rewards
  prizeAmount: z.number().min(0),
  prizeCurrency: z.string().min(1, "Currency is required"),
  prize1stAmount: z.number().min(0),
  prize2ndAmount: z.number().min(0),
  prize3rdAmount: z.number().min(0),
  
  // Submission rules
  maxSubmissionsPerUser: z.number().min(1).max(100).default(10),
  
  // Sponsored
  isSponsored: z.boolean().default(false),
  sponsorName: z.string().optional(),
  sponsorLogoUrl: z.string().url().optional().or(z.literal("")),
  sponsorLink: z.string().url().optional().or(z.literal("")),
}).refine((data) => isAfter(data.endAt, data.startAt), {
  message: "End date must be after start date",
  path: ["endAt"],
}).refine((data) => {
  if (data.prizeAmount === 0) return true;
  const total = data.prize1stAmount + data.prize2ndAmount + data.prize3rdAmount;
  return total === data.prizeAmount;
}, {
  message: "Prize breakdown must equal total prize pool",
  path: ["prize1stAmount"],
});

export type ChallengeFormValues = z.infer<typeof challengeFormSchema>;

export const defaultFormValues: Partial<ChallengeFormValues> = {
  title: "",
  game: "",
  difficulty: 3,
  heroMediaUrl: "",
  rulesSummary: "",
  rulesFull: "",
  startAt: new Date(),
  endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  minDurationSeconds: 6,
  maxDurationSeconds: 30,
  prizeAmount: 0,
  prizeCurrency: "USDC",
  prize1stAmount: 0,
  prize2ndAmount: 0,
  prize3rdAmount: 0,
  maxSubmissionsPerUser: 10,
  isSponsored: false,
  sponsorName: "",
  sponsorLogoUrl: "",
  sponsorLink: "",
};

export type DisabledFields = {
  timing?: boolean;
  prizes?: boolean;
  game?: boolean;
  difficulty?: boolean;
  clipRequirements?: boolean;
  submissionRules?: boolean;
};

interface ChallengeFormProps {
  form: UseFormReturn<ChallengeFormValues>;
  isReadOnly?: boolean;
  disabledFields?: DisabledFields;
  statusOverride?: string; // For displaying actual challenge status vs computed
}

function LockedBadge() {
  return (
    <Badge variant="outline" className="ml-2 text-xs bg-muted/50 text-muted-foreground">
      <Lock className="h-3 w-3 mr-1" />
      Locked
    </Badge>
  );
}
/**
 * Hero Media field with image upload + video URL input.
 */
function HeroMediaField({
  form,
  isReadOnly,
}: {
  form: UseFormReturn<ChallengeFormValues>;
  isReadOnly: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentValue = form.watch("heroMediaUrl") || "";

  // Check if current value looks like an image URL
  const isImageUrl = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i.test(currentValue);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, GIF, or AVIF image.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Must be authenticated");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("challenge-assets")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("challenge-assets")
        .getPublicUrl(path);

      form.setValue("heroMediaUrl", urlData.publicUrl, { shouldValidate: true });
      toast.success("Image uploaded!");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      // Reset file input so re-selecting the same file works
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <FormField
      control={form.control}
      name="heroMediaUrl"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center gap-1.5">
            <FormLabel>Hero Media</FormLabel>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                <p className="text-xs">Optimal dimensions: <strong>1920 × 1080 px</strong> (16:9). JPG, PNG, or WebP under 5 MB.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Image preview */}
          {currentValue && isImageUrl && (
            <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30 max-w-xs">
              <img
                src={currentValue}
                alt="Hero preview"
                className="w-full h-auto max-h-40 object-cover"
              />
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => form.setValue("heroMediaUrl", "", { shouldValidate: true })}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Upload button + URL input */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isReadOnly || uploading}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {uploading ? "Uploading…" : "Upload Image"}
            </Button>
            <span className="text-xs text-muted-foreground">or</span>
            <FormControl>
              <Input
                placeholder="https://example.com/video.mp4"
                {...field}
                disabled={isReadOnly}
                className="flex-1"
              />
            </FormControl>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={handleImageUpload}
          />

          <FormDescription>
            Upload an image or paste a video/image URL for the hero section
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ChallengeForm({ 
  form, 
  isReadOnly = false,
  disabledFields = {},
  statusOverride,
}: ChallengeFormProps) {
  const watchStartAt = form.watch("startAt");
  const watchEndAt = form.watch("endAt");
  const watchPrizeAmount = form.watch("prizeAmount");
  const watchPrize1st = form.watch("prize1stAmount");
  const watchPrize2nd = form.watch("prize2ndAmount");
  const watchPrize3rd = form.watch("prize3rdAmount");
  const watchIsSponsored = form.watch("isSponsored");

  // Compute status preview
  const statusPreview = useMemo(() => {
    if (statusOverride) return statusOverride;
    const now = new Date();
    if (!watchStartAt || !watchEndAt) return "Unknown";
    if (isBefore(now, watchStartAt)) return "Scheduled";
    if (isAfter(now, watchEndAt)) return "Ended";
    return "Active";
  }, [watchStartAt, watchEndAt, statusOverride]);

  // Prize breakdown validation
  const prizeBreakdownTotal = watchPrize1st + watchPrize2nd + watchPrize3rd;
  const prizeBreakdownValid = watchPrizeAmount === 0 || prizeBreakdownTotal === watchPrizeAmount;

  return (
    <Form {...form}>
      <div className="space-y-8 max-w-3xl">
        {/* Section A: Basics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basics</CardTitle>
            <CardDescription>Core challenge information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Triple Kill Challenge" 
                      {...field} 
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="game"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Game *
                      {disabledFields.game && <LockedBadge />}
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isReadOnly || disabledFields.game}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a game" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GAMES.map((game) => (
                          <SelectItem key={game} value={game}>
                            {game}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Difficulty (1-5)
                      {disabledFields.difficulty && <LockedBadge />}
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <Button
                            key={level}
                            type="button"
                            variant={field.value >= level ? "default" : "outline"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => field.onChange(level)}
                            disabled={isReadOnly || disabledFields.difficulty}
                          >
                            <Flame className={cn(
                              "h-4 w-4",
                              field.value >= level ? "text-primary-foreground" : "text-muted-foreground"
                            )} />
                          </Button>
                        ))}
                        <span className="text-sm text-muted-foreground ml-2">
                          {field.value}/5
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <HeroMediaField form={form} isReadOnly={isReadOnly} />
          </CardContent>
        </Card>

        {/* Section B: Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rules</CardTitle>
            <CardDescription>What participants need to accomplish</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="rulesSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rules Summary *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Get a triple kill in a single match" 
                      maxLength={200}
                      {...field} 
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormDescription>
                    Short summary shown on challenge cards ({field.value?.length || 0}/200)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rulesFull"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Rules *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed rules in markdown format..."
                      className="min-h-[150px] font-mono text-sm"
                      {...field} 
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormDescription>
                    Supports Markdown formatting
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section C: Timing */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Timing
                  {disabledFields.timing && <LockedBadge />}
                </CardTitle>
                <CardDescription>When the challenge runs</CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={cn(
                  statusPreview === "Active" && "bg-primary/20 text-primary border-primary/30",
                  statusPreview === "Scheduled" && "bg-accent/50 text-accent-foreground",
                  statusPreview === "Ended" && "bg-muted/50 text-muted-foreground",
                  statusPreview === "Draft" && "bg-muted/50 text-muted-foreground"
                )}
              >
                {statusPreview}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isReadOnly || disabledFields.timing}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isReadOnly || disabledFields.timing}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => watchStartAt && isBefore(date, watchStartAt)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section D: Clip Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Clip Requirements
              {disabledFields.clipRequirements && <LockedBadge />}
            </CardTitle>
            <CardDescription>Submission clip duration limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minDurationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Duration (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={300}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 6)}
                        disabled={isReadOnly || disabledFields.clipRequirements}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxDurationSeconds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Duration (seconds)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={300}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        disabled={isReadOnly || disabledFields.clipRequirements}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section E: Rewards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Rewards
              {disabledFields.prizes && <LockedBadge />}
            </CardTitle>
            <CardDescription>Prize pool and distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prizeAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Prize Pool</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        disabled={isReadOnly || disabledFields.prizes}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prizeCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isReadOnly || disabledFields.prizes}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="SOL">SOL</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-3 block">
                Top 3 Breakdown
                {!prizeBreakdownValid && watchPrizeAmount > 0 && (
                  <span className="text-destructive ml-2 font-normal">
                    (Total: {prizeBreakdownTotal} / {watchPrizeAmount})
                  </span>
                )}
                {prizeBreakdownValid && watchPrizeAmount > 0 && (
                  <CheckCircle className="inline-block h-4 w-4 text-primary ml-2" />
                )}
              </Label>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="prize1stAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">🥇 1st Place</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0}
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly || disabledFields.prizes}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prize2ndAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">🥈 2nd Place</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0}
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly || disabledFields.prizes}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prize3rdAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">🥉 3rd Place</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0}
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly || disabledFields.prizes}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section F: Submission Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Submission Rules
              {disabledFields.submissionRules && <LockedBadge />}
            </CardTitle>
            <CardDescription>Limits on user submissions</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="maxSubmissionsPerUser"
              render={({ field }) => (
                <FormItem className="max-w-xs">
                  <FormLabel>Max Submissions Per User</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={1} 
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                      disabled={isReadOnly || disabledFields.submissionRules}
                    />
                  </FormControl>
                  <FormDescription>
                    How many clips each user can submit
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section G: Sponsored */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Sponsor
                  <Sparkles className="h-4 w-4 text-primary" />
                </CardTitle>
                <CardDescription>Optional partner sponsorship</CardDescription>
              </div>
              <FormField
                control={form.control}
                name="isSponsored"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormLabel className="text-sm text-muted-foreground">Sponsored</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isReadOnly}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardHeader>
          {watchIsSponsored && (
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sponsorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sponsor Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Logitech" 
                        {...field} 
                        disabled={isReadOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sponsorLogoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field} 
                          disabled={isReadOnly}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sponsorLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..." 
                          {...field} 
                          disabled={isReadOnly}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Form validation summary */}
        {!isReadOnly && !form.formState.isValid && form.formState.submitCount > 0 && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Please fix the errors above</p>
              <p className="text-sm text-muted-foreground">
                Some required fields are missing or invalid.
              </p>
            </div>
          </div>
        )}
      </div>
    </Form>
  );
}
