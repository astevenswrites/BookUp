"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitQuiz } from "@/app/actions";
import type { TagOption, TagsByCategory } from "@/lib/tags";

type Step =
  | { kind: "text"; key: "favoriteBooksNote"; title: string; subtitle: string; placeholder: string }
  | { kind: "single"; key: "displayMode" | "heatLevelMax" | "pacing" | "readingFrequency"; title: string; subtitle: string; options: { value: string; label: string }[] }
  | { kind: "multi"; key: "mood" | "trope" | "genre"; title: string; subtitle: string; options: TagOption[]; filterByGenre?: boolean }
  | { kind: "multi-avoid"; key: "content_warning"; title: string; subtitle: string; options: TagOption[] };

type InitialAnswers = {
  favoriteBooksNote: string | null;
  displayMode: string;
  heatLevelMax: string | null;
  pacing: string | null;
  readingFrequency: string | null;
  tagIds: string[];
};

export function Quiz({
  tags,
  initial,
  redirectTo,
}: {
  tags: TagsByCategory;
  initial?: InitialAnswers;
  redirectTo?: string;
}) {
  const router = useRouter();
  const steps: Step[] = [
    {
      kind: "text",
      key: "favoriteBooksNote",
      title: "Name a book or two you loved.",
      subtitle: "Totally optional, but it helps us get to know your taste faster.",
      placeholder: "e.g. The Secret History, A Court of Thorns and Roses...",
    },
    {
      kind: "multi",
      key: "genre",
      title: "Favorite genres?",
      subtitle: "Choose a few — this helps us show you the right tropes and vibes next.",
      options: tags.genre,
    },
    {
      kind: "single",
      key: "displayMode",
      title: "How do you want to discover books?",
      subtitle: "You can change your mind later.",
      options: [
        { value: "cover_first", label: "Show me the covers" },
        { value: "vibe_first", label: "Surprise me — vibes first, cover hidden" },
      ],
    },
    {
      kind: "multi",
      key: "mood",
      title: "What kind of feeling are you chasing?",
      subtitle: "Pick as many as sound good for a rainy Sunday.",
      options: tags.mood,
      filterByGenre: true,
    },
    {
      kind: "multi",
      key: "trope",
      title: "Any tropes you can't resist?",
      subtitle: "Select the ones that make you swipe right immediately.",
      options: tags.trope,
      filterByGenre: true,
    },
    {
      kind: "single",
      key: "heatLevelMax",
      title: "How much heat do you want?",
      subtitle: "We'll keep things at or below this level.",
      options: [
        { value: "none", label: "None" },
        { value: "low", label: "A little" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "Bring it" },
      ],
    },
    {
      kind: "single",
      key: "pacing",
      title: "Slow burn or fast-paced?",
      subtitle: "What keeps you turning pages?",
      options: [
        { value: "slow_burn", label: "Slow burn" },
        { value: "medium", label: "Somewhere in between" },
        { value: "fast_paced", label: "Fast-paced" },
      ],
    },
    {
      kind: "single",
      key: "readingFrequency",
      title: "How often do you read?",
      subtitle: "No wrong answer here.",
      options: [
        { value: "casual", label: "Casual" },
        { value: "regular", label: "Regular" },
        { value: "voracious", label: "Voracious" },
      ],
    },
    {
      kind: "multi-avoid",
      key: "content_warning",
      title: "Anything you'd rather avoid?",
      subtitle: "Optional — books with these will never be shown to you.",
      options: tags.content_warning,
    },
  ];

  const [stepIndex, setStepIndex] = useState(0);
  const [multiSelections, setMultiSelections] = useState<Record<string, Set<string>>>(() => {
    if (!initial) return {};
    const idsByCategory: Record<string, Set<string>> = { mood: new Set(), trope: new Set(), genre: new Set(), content_warning: new Set() };
    const initialIds = new Set(initial.tagIds);
    for (const category of Object.keys(idsByCategory) as (keyof TagsByCategory)[]) {
      for (const opt of tags[category]) {
        if (initialIds.has(opt.id)) idsByCategory[category].add(opt.id);
      }
    }
    return idsByCategory;
  });
  const [singleSelections, setSingleSelections] = useState<Record<string, string>>(() => ({
    displayMode: initial?.displayMode ?? "",
    heatLevelMax: initial?.heatLevelMax ?? "",
    pacing: initial?.pacing ?? "",
    readingFrequency: initial?.readingFrequency ?? "",
  }));
  const [favoriteBooksNote, setFavoriteBooksNote] = useState(initial?.favoriteBooksNote ?? "");
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const selectedGenreLabels = new Set(
    tags.genre.filter((g) => multiSelections.genre?.has(g.id)).map((g) => g.label)
  );

  // D44: once a genre is picked, lead with the tropes/moods that actually
  // show up on books in that genre — but never hide options behind a filter
  // that would zero them out (no genre picked yet, or a genre with no
  // catalog matches yet) and always let the reader expand to everything.
  function getVisibleOptions(s: Extract<Step, { kind: "multi" | "multi-avoid" }>): TagOption[] {
    if (s.kind !== "multi" || !s.filterByGenre) return s.options;
    if (expandedSteps.has(s.key) || selectedGenreLabels.size === 0) return s.options;
    const filtered = s.options.filter((opt) =>
      opt.relevantGenres?.some((g) => selectedGenreLabels.has(g))
    );
    return filtered.length > 0 ? filtered : s.options;
  }

  const visibleOptions = step.kind === "multi" || step.kind === "multi-avoid" ? getVisibleOptions(step) : [];
  const hasMoreToShow =
    step.kind === "multi" &&
    step.filterByGenre &&
    !expandedSteps.has(step.key) &&
    visibleOptions.length < step.options.length;

  function toggleMulti(key: string, id: string) {
    setMultiSelections((prev) => {
      const next = new Set(prev[key] ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: next };
    });
  }

  function selectSingle(key: string, value: string) {
    setSingleSelections((prev) => ({ ...prev, [key]: value }));
  }

  function handleNext() {
    if (!isLastStep) {
      setStepIndex((i) => i + 1);
      return;
    }

    const formData = new FormData();
    if (favoriteBooksNote.trim()) formData.set("favoriteBooksNote", favoriteBooksNote.trim());
    if (singleSelections.displayMode) formData.set("displayMode", singleSelections.displayMode);
    if (singleSelections.heatLevelMax) formData.set("heatLevelMax", singleSelections.heatLevelMax);
    if (singleSelections.pacing) formData.set("pacing", singleSelections.pacing);
    if (singleSelections.readingFrequency)
      formData.set("readingFrequency", singleSelections.readingFrequency);

    const allTagIds = Object.values(multiSelections).flatMap((set) => [...set]);
    for (const id of allTagIds) formData.append("tagIds", id);

    startTransition(async () => {
      await submitQuiz(formData);
      if (redirectTo) router.push(redirectTo);
    });
  }

  function canProceed(): boolean {
    if (step.kind === "single") return Boolean(singleSelections[step.key]);
    return true; // text and multi-select steps (including avoid) are optional
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-accent" : "bg-card-border"}`}
          />
        ))}
      </div>

      <h1 className="font-serif text-2xl text-on-vibe">{step.title}</h1>
      <p className="mt-1 text-sm text-on-vibe-muted">{step.subtitle}</p>

      {step.kind === "text" ? (
        <textarea
          value={favoriteBooksNote}
          onChange={(e) => setFavoriteBooksNote(e.target.value)}
          placeholder={step.placeholder}
          rows={3}
          maxLength={500}
          className="mt-6 w-full rounded-lg border border-card-border bg-card p-3 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      ) : (
        <div className="mt-6 flex flex-wrap gap-2">
          {step.kind === "single"
            ? step.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectSingle(step.key, opt.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    singleSelections[step.key] === opt.value
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-card-border bg-card text-foreground hover:border-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))
            : visibleOptions.map((opt) => {
                const selected = multiSelections[step.key]?.has(opt.id) ?? false;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleMulti(step.key, opt.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-card-border bg-card text-foreground hover:border-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
        </div>
      )}

      {hasMoreToShow && (
        <button
          type="button"
          onClick={() => setExpandedSteps((prev) => new Set(prev).add(step.key))}
          className="mt-4 self-start text-sm font-medium text-accent underline underline-offset-2"
        >
          Show all {step.options.length} — including other genres
        </button>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          className="text-sm text-on-vibe-muted disabled:opacity-0"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed() || isPending}
          className="rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          {isPending
            ? "Saving..."
            : isLastStep
              ? initial
                ? "Save changes"
                : "Show me books"
              : "Next"}
        </button>
      </div>
    </div>
  );
}
