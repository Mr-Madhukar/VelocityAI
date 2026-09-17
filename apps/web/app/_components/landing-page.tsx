import { LandingNav } from "./landing/nav";
import { LandingHero } from "./landing/hero";
import { ProductDemo } from "./landing/product-demo";
import { HowItWorks } from "./landing/how-it-works";
import { FeatureBento } from "./landing/feature-bento";
import { CliSection } from "./landing/cli-section";
import { LandingMetrics } from "./landing/metrics";
import { LandingPricing } from "./landing/pricing";
import { LandingCta } from "./landing/cta";
import { LandingFooter } from "./landing/footer";

export function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden">
      <LandingNav />
      <LandingHero />
      <ProductDemo />
      <HowItWorks />
      <FeatureBento />
      <CliSection />
      <LandingMetrics />
      <LandingPricing />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
