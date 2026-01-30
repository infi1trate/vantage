import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { PerspectiveSection } from "@/components/landing/PerspectiveSection";
import { TimelineSection } from "@/components/landing/TimelineSection";
import { ValueSection } from "@/components/landing/ValueSection";
import { LivePreviewSection } from "@/components/landing/LivePreviewSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <LandingNav />
      <HeroSection />
      <PerspectiveSection />
      <TimelineSection />
      <ValueSection />
      <LivePreviewSection />
      <FeaturesSection />
      <StatsSection />
      <HowItWorksSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default Index;
