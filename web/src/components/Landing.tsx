import Link from "next/link";
import { LandingMoodDemo } from "@/components/LandingMoodDemo";
import { DAILY_SWIPE_CAP } from "@/lib/constants";

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
export function Landing() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-20 sm:px-8">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
        <div>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-accent">
            A dating app, but for books
          </p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.02] tracking-tight text-on-vibe sm:text-6xl">
            Hook Up with BookUp
          </h1>
          <p className="mt-4 font-serif text-xl italic text-accent sm:text-2xl">
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

        <LandingMoodDemo />
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
    </div>
  );
}
