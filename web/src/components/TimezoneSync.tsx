"use client";

import { useEffect } from "react";
import { setTimezone } from "@/app/actions";

// Renders nothing — just reconciles the reader's actual local timezone
// (unavailable server-side) into Preference.timezone once per change, so
// Today's Picks (D35) resets at their local midnight instead of UTC.
export function TimezoneSync({ currentTimezone }: { currentTimezone: string | null }) {
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== currentTimezone) {
        void setTimezone(detected);
      }
    } catch {
      // Intl.DateTimeFormat unsupported — localDateString() falls back to UTC.
    }
  }, [currentTimezone]);

  return null;
}
