import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { getSessionId } from "@/lib/session";
import { getPreferenceForSession, getPreferenceMoodLabels } from "@/lib/preferences";
import { deriveVibeTheme } from "@/lib/theme";
import { VibeBackground } from "@/components/VibeBackground";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

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
  const sessionId = await getSessionId();
  const preference = sessionId ? await getPreferenceForSession(sessionId) : null;
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
        {preference && <ThemeSwitcher currentOverride={preference.themeOverride} />}
        {children}
      </body>
    </html>
  );
}
