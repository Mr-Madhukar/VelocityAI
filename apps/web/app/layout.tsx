import type { Metadata } from "next";
import { Instrument_Serif, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalProviders } from "~/providers/global";
import { AnimatedBackground } from "~/components/animated-background";
import { SmoothScroll } from "~/components/smooth-scroll";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});
// Display + accent pairing for landing headings / special text only
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VelocityAI",
  description:
    "AI product ops for turning feature ideas into reviewed, approved, shipped software.",
  icons: {
    icon: [
      { url: "/icons/velocity-mark.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/velocity-mark.svg",
  },
  openGraph: {
    title: "VelocityAI",
    description:
      "AI product ops for turning feature ideas into reviewed, approved, shipped software.",
    images: ["/icons/velocity-logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${instrumentSerif.variable} relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/25 selection:text-foreground`}>
        <AnimatedBackground />
        <SmoothScroll />
        <GlobalProviders>
          <div className="relative z-10 flex min-h-screen flex-col">
            {children}
          </div>
        </GlobalProviders>
      </body>
    </html>
  );
}
