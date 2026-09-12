import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor, getPreferenceMoodLabels } from "@/lib/preferences";
import { deriveVibeTheme } from "@/lib/theme";
import { VibeBackground } from "@/components/VibeBackground";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AuthStatus } from "@/components/AuthStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Placeholder title typeface pending branding — see DECISIONS.md D13
const bookSerif = Fraunces({
  variable: "--font-book-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Book Dating App (placeholder name)",
  description: "Swipe your way to your next great read.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;
  const theme = preference
    ? deriveVibeTheme(getPreferenceMoodLabels(preference), preference.themeOverride)
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bookSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <VibeBackground theme={theme} />
        <AuthStatus />
        {preference && <ThemeSwitcher currentOverride={preference.themeOverride} />}
        {children}
      </body>
    </html>
  );
}
