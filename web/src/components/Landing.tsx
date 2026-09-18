import Link from "next/link";
import { LandingMoodDemo } from "@/components/LandingMoodDemo";
import { HomepageQRCode } from "@/components/HomepageQRCode";
import { DAILY_SWIPE_CAP } from "@/lib/constants";
import { getDemoTheme } from "@/lib/session";
import { getActor, hasIdentity } from "@/lib/actor";
import { getPreferenceForActor, getPreferenceMoodLabels } from "@/lib/preferences";
import { DEFAULT_VIBE_THEME, deriveVibeTheme } from "@/lib/theme";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "35 swipes a day",
    features: [
      `${DAILY_SWIPE_CAP} swipes a day, refreshed each morning`,
      "One shelf, sorted by vibe",
      "Full mood, trope, and content-warning filters",
    ],
  },
  {
    name: "BookUp Premium",
    price: "$4/mo",
    note: "For the voracious",
    features: [
      "Unlimited swipes — read the whole deck in one sitting",
      "Undo a pass you regret",
      "Separate shelves per mood, plus export",
      "First look at new releases matching your vibe",
    ],
  },
];

// D87: illustrative only, no live data -- an anonymous visitor has no
// Preference yet, and D24/D50 already established that content-warning
// filtering isn't a per-feature opt-in, so showing real book data here
// (which would need to skip that filtering) isn't on the table. Same
// static-copy posture as PLANS above.
const RETENTION_FEATURES = [
  { emoji: "🔥", title: "Streaks", body: "Come back daily and watch your streak build." },
  { emoji: "⭐", title: "Weekly Super Match", body: "One standout pick, hand-picked for your taste, every week." },
  { emoji: "🎃", title: "Seasonal challenges", body: "Genre-themed discovery pushes, tied to what's in season." },
  { emoji: "📈", title: "Trending", body: "See what every reader's adding right now." },
  { emoji: "🔀", title: "Blind date", body: "One surprise pick when you don't want to choose." },
  { emoji: "📤", title: "Share your matches", body: "Turn a great match into a shareable card." },
];

const STEPS = [
  {
    num: "01",
    title: "Answer nine quick questions",
    body: "Moods, tropes, heat, pacing, and the things you never want to read about. Two minutes, no account.",
  },
  {
    num: "02",
    title: "Swipe a deck built for you",
    body: "Mood and trope matches count triple. Genre is a tiebreaker, not the whole point.",
  },
  {
    num: "03",
    title: "Your shelf sorts itself by feeling",
    body: "Not alphabetical. Grouped by the vibe that made you save it in the first place.",
  },
];

// D41: marketing landing page — pricing is static copy only (no billing
// exists yet, that's Phase 5); "Start the vibe check" is the only real path
// into the product for a first-time visitor.
// D64: an anonymous session that's already taken the quiz can land here too
// now (D62 — Landing shows for anyone not signed in, preference or not), so
// this can no longer assume "no preference yet" the way it could pre-D62.
// When a preference exists, the mood picker has to drive the SAME
// themeOverride the real post-quiz ThemeSwitcher pill uses — that pill is
// already rendered globally for this exact actor (layout.tsx's `preference
// && <ThemeSwitcher>` doesn't check sign-in status), so two independent
// theme pickers were showing at once, and only one of them worked.
export async function Landing() {
  const actor = await getActor();
  const preference = hasIdentity(actor) ? await getPreferenceForActor(actor) : null;
  const initialTheme = preference
    ? deriveVibeTheme(getPreferenceMoodLabels(preference), preference.themeOverride) ?? DEFAULT_VIBE_THEME
    : (await getDemoTheme()) ?? DEFAULT_VIBE_THEME;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:px-8">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-on-vibe-accent">
            A dating app, but for books
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight text-on-vibe sm:text-6xl">
            Hook Up with BookUp
          </h1>
          <p className="mt-4 font-serif text-xl italic text-on-vibe-accent sm:text-2xl">
            Get paired with your ideal book match!
          </p>
          <p className="mt-5 max-w-prose text-base leading-relaxed text-on-vibe-muted sm:text-lg">
            Tell us the mood you&apos;re chasing, the tropes you&apos;d swipe right on, and the
            things you&apos;d rather not read about. We&apos;ll shuffle up books that match the
            feeling — and the whole page will start to look like it.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/quiz"
              className="rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-foreground shadow-lg"
            >
              Start the vibe check
            </Link>
            <Link
              href="/review"
              className="rounded-full border border-card-border bg-card/70 px-6 py-3.5 text-sm font-medium text-foreground"
            >
              Peek at the deck
            </Link>
          </div>
          <p className="mt-4 text-sm text-on-vibe-muted">
            Free account, {DAILY_SWIPE_CAP} swipes a day. Go premium when {DAILY_SWIPE_CAP} stops
            being enough.
          </p>
        </div>

        <LandingMoodDemo initialTheme={initialTheme} persistent={!!preference} />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-6 backdrop-blur-sm ${
              plan.name === "Free"
                ? "border-card-border bg-card/75"
                : "border-accent bg-card/90 shadow-lg"
            }`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="font-serif text-xl font-semibold text-foreground">
                {plan.name}
              </span>
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                  plan.name === "Free"
                    ? "bg-tag-genre text-tag-genre-foreground"
                    : "bg-tag-trope text-tag-trope-foreground"
                }`}
              >
                {plan.note}
              </span>
            </div>
            <p className="mb-4 font-serif text-3xl font-semibold tracking-tight text-foreground">
              {plan.price}
            </p>
            <ul className="flex flex-col gap-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <span className="text-sm leading-relaxed text-foreground/80">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.num} className="border-t-2 border-on-vibe pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-on-vibe-muted">
              {step.num}
            </p>
            <p className="mb-1.5 font-serif text-lg text-on-vibe">{step.title}</p>
            <p className="text-sm leading-relaxed text-on-vibe-muted">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16">
        <p className="mb-6 text-center font-serif text-2xl text-on-vibe">
          Then it keeps getting better
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {RETENTION_FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-card-border bg-card/75 p-5 backdrop-blur-sm"
            >
              <p className="font-serif text-lg text-foreground">
                {feature.emoji} {feature.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>

      <HomepageQRCode />
    </div>
  );
}
