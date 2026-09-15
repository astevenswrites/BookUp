import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { getActor, hasIdentity } from "@/lib/actor";
import { getDemoTheme } from "@/lib/session";
import { getPreferenceForActor, getPreferenceMoodLabels } from "@/lib/preferences";
import { deriveVibeTheme, DEFAULT_VIBE_THEME, THEME_CONFIG, INK_TOKENS } from "@/lib/theme";
import type { CSSProperties } from "react";
import { VibeBackground } from "@/components/VibeBackground";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AuthStatus } from "@/components/AuthStatus";
import { TimezoneSync } from "@/components/TimezoneSync";

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
  title: "BookUp",
  description: "Hook up with your next great read.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;
  const demoTheme = preference ? null : await getDemoTheme();
  const theme =
    (preference
      ? deriveVibeTheme(getPreferenceMoodLabels(preference), preference.themeOverride)
      : demoTheme) ?? DEFAULT_VIBE_THEME;
  const isDarkVibe = THEME_CONFIG[theme].isDark;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bookSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        data-mode={isDarkVibe ? "dark" : "light"}
        style={INK_TOKENS[theme] as CSSProperties}
      >
        <VibeBackground theme={theme} />
        <AuthStatus />
        <TimezoneSync currentTimezone={preference?.timezone ?? null} />
        {preference && <ThemeSwitcher currentOverride={preference.themeOverride} />}
        {children}
      </body>
    </html>
  );
}
