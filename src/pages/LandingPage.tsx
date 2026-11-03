import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowsRotate, BarChart3, Bell, BookOpen, Check, ChevronDown, ChevronRight, ClipboardCheck, Comments, Compass,
  FileArrowUp, FilePdf, FilePowerpoint, FileText, FileWord, FolderOpen, Globe, Image as ImageIcon, Layers, Lock, Menu, RightToBracket, Rocket, Share2, Sparkles, Stopwatch, Users, X,
} from '../icons';
import type { IconComponent } from '../icons';
import { Logo } from '../components/common/Logo';
import { useForcedDarkTheme } from '../contexts/ThemeContext';
import { buttonClasses } from '../components/common/Button';
import { AppPreview } from '../components/landing/AppPreview';
import { CookieBanner } from '../components/landing/CookieBanner';
import { getCookieConsent } from '../lib/cookies';

/*
 * REVI landing, v5 (UI refresh).
 * What changed from v4:
 *  - Hero is centered on phones and tablets and left aligned beside the preview on desktop.
 *    The app preview sits on a stack of index cards, the same object the flashcard demo uses.
 *  - Feature section is no longer nine identical cards: three core tools get large tinted cards,
 *    the other six are quiet rows separated by hairlines.
 *  - Section headings are left aligned and the small label above each heading is gone.
 *  - Sharing is drawn as a scale from narrowest to widest reach.
 *  - Steps are connected, because they really are a sequence.
 *  - The closing call to action is a single ruled index card: centered on phones, side by side from 640px up.
 * Copy only describes what the app does today: no invented numbers or reviews.
 */

const sectionIds = ['features', 'tools', 'flashcards', 'sharing', 'how-it-works'] as const;

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#tools', label: 'AI tools' },
  { href: '#flashcards', label: 'Practice' },
  { href: '#sharing', label: 'Sharing' },
  { href: '#how-it-works', label: 'How it works' },
];

const features: { icon: IconComponent; title: string; text: string }[] = [
  { icon: FileArrowUp, title: 'Reviewers from your files', text: 'Upload PDF, Word, PowerPoint, text, or image files up to 10 MB each. Add a subject and tags to keep them sorted.' },
  { icon: Sparkles, title: 'AI study tools', text: 'Generate a summary, key concepts, flashcards, a quiz, or a plain-language explanation from any reviewer you can access.' },
  { icon: Layers, title: 'Flashcard decks', text: 'Flip through decks, mark each card as got it or needs review, and shuffle to mix them up.' },
  { icon: ClipboardCheck, title: 'Timed quizzes', text: 'Multiple-choice and true-or-false questions, graded on the server, with explanations after you answer.' },
  { icon: Comments, title: 'Study Chat', text: 'Ask questions and get answers based on the reviewers you pick, so replies stay tied to your notes.' },
  { icon: FolderOpen, title: 'Collections', text: 'Group related reviewers by course or exam so everything for one topic sits together.' },
  { icon: Compass, title: 'Discover', text: 'Browse reviewers other students have made public, and publish your own when you are ready.' },
  { icon: BarChart3, title: 'Progress tracking', text: 'A dashboard, analytics, and study history with a weekly goal you set for yourself.' },
  { icon: Bell, title: 'Live notifications', text: 'Get told when a shared reviewer is edited or gets a new file, without reloading the page.' },
];

/* Ordered from narrowest to widest reach. */
const visibility: { icon: IconComponent; label: string; text: string }[] = [
  { icon: Lock, label: 'Private', text: 'Only you can see it.' },
  { icon: Share2, label: 'Shared', text: 'Only people you add by username.' },
  { icon: Users, label: 'Friends', text: 'You and friends you have accepted.' },
  { icon: Globe, label: 'Public', text: 'Anyone signed in can find it in Discover.' },
];

const steps: { icon: IconComponent; title: string; text: string }[] = [
  { icon: FileArrowUp, title: 'Add your material', text: 'Upload slides, PDFs, Word files, or notes, then give the reviewer a title, a subject, and tags.' },
  { icon: Sparkles, title: 'Generate your tools', text: 'Pick a summary, key concepts, flashcards, a quiz, or an explanation. Each is built from that reviewer.' },
  { icon: BarChart3, title: 'Study and track progress', text: 'Work through flashcards and quizzes, ask Study Chat when you get stuck, and watch your study time add up.' },
];

const fileTypes: { icon: IconComponent; label: string; ext: string }[] = [
  { icon: FilePdf, label: 'PDF', ext: '.pdf' },
  { icon: FileWord, label: 'Word', ext: '.docx' },
  { icon: FilePowerpoint, label: 'PowerPoint', ext: '.pptx' },
  { icon: FileText, label: 'Text', ext: '.txt' },
  { icon: ImageIcon, label: 'Images', ext: '.png .jpg .webp' },
];

const demoCards = [
  { q: 'What is active recall?', a: 'Pulling an answer out of memory instead of rereading it.' },
  { q: 'What does spaced repetition do?', a: 'It spreads your reviews over time so you forget less.' },
  { q: 'Why explain an answer in your own words?', a: 'It shows what you understand, not just what you recognize.' },
];

const tools = ['Summary', 'Key concepts', 'Flashcards', 'Quiz', 'Explanation'] as const;
type ToolName = (typeof tools)[number];

/* REVI palette (Charcoal & Butter Yellow), declared on the page root so it works even if the global CSS lacks it.
   Butter yellow #FFD84D, warm cream #FFF9EE, soft lavender #A5A0E8 / #B9B2D7, pencil gold #F5A623,
   charcoal plum base #201F29 (background), #2B2937 (surface), #393644 (elevated). */
const reviVars = {
  '--revi-lavender': '165 160 232',
  '--revi-soft-lavender': '185 178 215',
  '--revi-cream': '255 249 238',
  '--revi-gold': '255 216 77',
  '--revi-pencil-gold': '245 166 35',
  '--revi-orange': '245 166 35',
  '--revi-orange-soft': '247 190 85',
  '--revi-blush': '246 183 183',
  '--revi-graphite': '101 97 114',
  '--revi-midnight': '32 31 41',
  '--revi-navy': '43 41 55',
  '--revi-soft-navy': '57 54 68',
} as CSSProperties;
const MIDNIGHT_RGB = 'rgb(32 31 41)'; /* literal, because <body> sits outside the page root's variables */

const revi = (name: string) => `rgb(var(--revi-${name}))`;
const palette = {
  ...reviVars,
  '--background': 'var(--revi-midnight)',
  '--surface': 'var(--revi-navy)',
  '--surface-muted': '50 47 62',
  '--surface-raised': 'var(--revi-soft-navy)',
  '--foreground': '248 245 236',
  '--foreground-muted': '197 192 208',
  '--border': '64 61 75',
  '--accent-mint': 'var(--revi-gold)',
  '--accent-mint-surface': '75 69 50',
  '--accent-lavender': 'var(--revi-lavender)',
  '--accent-lavender-surface': 'var(--revi-soft-navy)',
  '--accent-orange': 'var(--revi-orange)',
  '--accent-blush': 'var(--revi-blush)',
  '--primary': 'var(--revi-gold)',
  '--primary-foreground': '41 39 53',
  '--brand': 'var(--revi-gold)',
  '--on-accent': '41 39 53',
  '--success': '112 214 165',
  '--sidebar': 'var(--revi-midnight)',
  '--overlay': 'var(--revi-midnight)',
  colorScheme: 'dark',
} as CSSProperties;

/* Page background: layered glows (butter yellow top right, lavender top left, lavender and a hint of yellow
   at the foot) over a charcoal-plum base that lifts slightly toward the middle of the page. */
const pageGradient = [
  'radial-gradient(60rem 34rem at 88% -4%, rgb(var(--revi-gold) / 0.16), transparent 70%)',
  'radial-gradient(52rem 34rem at -6% 6%, rgb(var(--revi-lavender) / 0.24), transparent 70%)',
  'radial-gradient(70rem 32rem at 50% 102%, rgb(var(--revi-lavender) / 0.30), rgb(var(--revi-gold) / 0.08) 55%, transparent 78%)',
  `linear-gradient(180deg, ${revi('midnight')} 0%, rgb(38 36 49) 48%, ${revi('navy')} 100%)`,
].join(', ');

/* Theme tokens (resolved from the palette above) */
const text = 'rgb(var(--foreground))';
const onAccent = 'rgb(var(--background))';
const pageBg = 'rgb(var(--background))';
const surface = 'rgb(var(--surface))';
const surfaceMuted = 'rgb(var(--surface-muted))';
const surfaceRaised = 'rgb(var(--surface-raised))';
const border = 'rgb(var(--border))';
const gold = revi('gold');
const pencilGold = revi('pencil-gold');
const orange = revi('orange');
const orangeSoft = revi('orange-soft');
const lavender = revi('lavender');
const softLavender = revi('soft-lavender');
const blush = revi('blush');
const lavenderSurface = 'rgb(var(--accent-lavender-surface))';
const accents = [gold, softLavender, orange, blush];

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-lavender))] focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const wrap = 'mx-auto w-full max-w-6xl px-4 min-[400px]:px-5 sm:px-8 xl:max-w-7xl';
const pill = '!rounded-full';
const display = 'font-landing text-balance font-extrabold leading-[1.06] tracking-tight';
const h2Class = `${display} text-[1.85rem] min-[400px]:text-[2.1rem] sm:text-[2.5rem] lg:text-[3rem]`;

const card: CSSProperties = {
  backgroundColor: surface,
  backgroundImage: 'linear-gradient(155deg, rgb(var(--surface-raised) / 0.95), rgb(var(--surface)) 62%)',
  border: `1px solid ${border}`,
  boxShadow: 'inset 0 1px 0 rgb(var(--revi-cream) / 0.07)',
};

/* The ruled index card. Used by the flashcard demo, the hero stack, and the closing call to action. */
const indexCard: CSSProperties = {
  backgroundColor: revi('cream'),
  backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgb(var(--revi-navy) / 0.14) 31px 32px)',
  color: revi('navy'),
};

/* Primary button recolored for use on a cream card. */
const onCreamPrimary = `${pill} !bg-[rgb(var(--revi-navy))] !text-[rgb(var(--revi-cream))]`;

function Glow({ color, className }: { color: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute rounded-full opacity-20 blur-3xl md:blur-[110px] ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}

/** Scrolls to a section or demo on this page and moves focus into it. No navigation. */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  const focusable = el.querySelector<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
  focusable?.focus({ preventScroll: true });
}

function SectionHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <h2 className={h2Class}>{title}</h2>
      {children && <p className="mt-4 max-w-xl text-base leading-[1.7] opacity-75 sm:text-lg">{children}</p>}
    </div>
  );
}

function IconBadge({ icon: Icon, color, size = 'md' }: { icon: IconComponent; color: string; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'}`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Flashcard deck                                                      */
/* ------------------------------------------------------------------ */
function IndexCardDeck() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const done = index >= demoCards.length;
  const current = demoCards[Math.min(index, demoCards.length - 1)];
  const remaining = Math.max(demoCards.length - index - 1, 0);
  const face: CSSProperties = { backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' };

  const rate = (gotIt: boolean) => {
    if (gotIt) setKnown((v) => v + 1);
    setFlipped(false);
    setIndex((v) => v + 1);
  };
  const reset = () => {
    setIndex(0);
    setKnown(0);
    setFlipped(false);
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative h-64 min-[400px]:h-72 sm:h-80">
        {!done && remaining >= 2 && (
          <span aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-2xl border" style={{ backgroundColor: lavenderSurface, borderColor: border }} />
        )}
        {!done && remaining >= 1 && (
          <span aria-hidden className="absolute inset-0 translate-x-1.5 translate-y-1.5 -rotate-2 rounded-2xl border" style={{ backgroundColor: surfaceMuted, borderColor: border }} />
        )}

        {done ? (
          <div role="status" className="relative flex h-full flex-col justify-between rounded-2xl border p-5 shadow-2xl sm:p-7" style={{ ...indexCard, borderColor: border }}>
            <p className={`${display} text-3xl sm:text-4xl`}>You knew {known} of {demoCards.length}.</p>
            <p className="text-[15px] leading-relaxed opacity-80">
              REVI tracks the cards you missed so you can review them again. Try the same thing with your own notes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/login?mode=signup" className={buttonClasses('primary', onCreamPrimary)}>
                <Rocket className="h-4 w-4" /> Create free account
              </Link>
              <button type="button" onClick={reset} className={buttonClasses('secondary', `${pill} !border-[rgb(var(--revi-navy)/0.3)] !text-[rgb(var(--revi-navy))] hover:!bg-[rgb(var(--revi-navy)/0.08)]`)}>
                <ArrowsRotate className="h-4 w-4" /> Try again
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            aria-label={flipped ? 'Show the question' : 'Flip the card to see the answer'}
            className={`relative block h-full w-full rounded-2xl text-left shadow-2xl ${focusRing}`}
            style={{ perspective: '1100px' }}
          >
            <span
              className="relative block h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              <span aria-hidden={flipped} className="absolute inset-0 flex flex-col justify-between rounded-2xl border p-5 sm:p-7" style={{ ...face, ...indexCard, borderColor: border }}>
                <span className="flex items-center justify-between text-sm font-semibold opacity-70">
                  <span>Card {index + 1} of {demoCards.length}</span>
                  <span className="flex items-center gap-1.5"><ArrowsRotate className="h-4 w-4" aria-hidden /> Tap to flip</span>
                </span>
                <span className={`${display} text-[1.35rem] min-[400px]:text-[1.6rem] sm:text-[2.2rem]`}>{current.q}</span>
              </span>
              <span
                aria-hidden={!flipped}
                className="absolute inset-0 flex flex-col justify-between rounded-2xl p-5 sm:p-7"
                style={{ ...face, transform: 'rotateY(180deg)', backgroundColor: lavender, color: revi('navy') }}
              >
                <span className="text-sm font-semibold opacity-70">Answer</span>
                <span className={`${display} text-lg min-[400px]:text-xl sm:text-3xl`}>{current.a}</span>
                <span className="text-sm font-medium opacity-70">How did you do?</span>
              </span>
            </span>
          </button>
        )}
      </div>

      {!done && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => rate(false)} disabled={!flipped} className={buttonClasses('secondary', `justify-center py-3 ${pill}`)}>
              <ArrowsRotate className="h-4 w-4" /> Still learning
            </button>
            <button type="button" onClick={() => rate(true)} disabled={!flipped} className={buttonClasses('mint', `justify-center py-3 ${pill}`)}>
              <Check className="h-4 w-4" /> Got it
            </button>
          </div>
          <p className="mt-3 text-center text-xs opacity-70" aria-live="polite">
            {flipped ? 'Rate yourself honestly. Missed cards come back.' : 'Flip the card first, then rate yourself.'}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Study tool switcher (sample output)                                 */
/* ------------------------------------------------------------------ */
function QuizSample() {
  const [picked, setPicked] = useState<number | null>(null);
  const options = ['Rereading the chapter twice', 'Answering from memory first', 'Highlighting every key line'];
  const correct = 1;

  return (
    <div>
      <p className="text-lg font-bold">Which habit is active recall?</p>
      <ul className="mt-4 grid gap-2">
        {options.map((option, i) => {
          const isPicked = picked === i;
          const showResult = picked !== null;
          const isCorrect = i === correct;
          return (
            <li key={option}>
              <button
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={isPicked}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition-colors motion-reduce:transition-none ${focusRing}`}
                style={{
                  borderColor: showResult && isCorrect ? gold : isPicked ? orange : border,
                  backgroundColor: showResult && isCorrect ? 'rgb(var(--accent-mint) / 0.14)' : 'transparent',
                }}
              >
                <span>{option}</span>
                {showResult && isCorrect && <Check className="h-4 w-4 shrink-0" style={{ color: gold }} aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm leading-relaxed opacity-80" aria-live="polite">
        {picked === null
          ? 'Pick an answer to see the explanation.'
          : picked === correct
            ? 'Correct. Answering from memory first is what makes the review stick.'
            : 'Not quite. Answering from memory first is active recall.'}
      </p>
    </div>
  );
}

function ToolOutput({ tool }: { tool: ToolName }) {
  switch (tool) {
    case 'Summary':
      return (
        <p className="text-lg font-semibold leading-relaxed">
          Studying works best when you retrieve answers from memory, space your reviews over time, and explain ideas in your own words.
        </p>
      );
    case 'Key concepts':
      return (
        <ul className="grid gap-3">
          {['Active recall', 'Spaced repetition', 'Self-explanation'].map((c, i) => (
            <li key={c} className="flex items-center gap-3 text-lg font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accents[i] }} aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      );
    case 'Flashcards':
      return (
        <ul className="grid gap-3">
          {demoCards.slice(0, 2).map((c) => (
            <li key={c.q} className="rounded-xl border p-4" style={{ borderColor: border }}>
              <p className="font-bold">{c.q}</p>
              <p className="mt-1 text-sm opacity-75">{c.a}</p>
            </li>
          ))}
        </ul>
      );
    case 'Quiz':
      return <QuizSample />;
    case 'Explanation':
      return (
        <p className="text-base leading-[1.75] opacity-90">
          Rereading feels easy, so it can trick you into thinking you know something. Trying to answer first is harder, and that effort is what builds memory. Coming back to the same material a few days later helps it stay.
        </p>
      );
  }
}

const toolIcons: Record<ToolName, IconComponent> = {
  'Summary': BookOpen,
  'Key concepts': Sparkles,
  'Flashcards': Layers,
  'Quiz': ClipboardCheck,
  'Explanation': Comments,
};

function ToolSwitcher() {
  const [tool, setTool] = useState<ToolName>('Summary');

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-3xl p-4 sm:p-6" style={card}>
      <div role="tablist" aria-label="Study tools" className="flex flex-wrap gap-2">
        {tools.map((name) => {
          const selected = name === tool;
          const Icon = toolIcons[name];
          return (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tool-tab-${name}`}
              aria-selected={selected}
              aria-controls="tool-panel"
              onClick={() => setTool(name)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm transition-colors motion-reduce:transition-none ${focusRing}`}
              style={selected ? { backgroundColor: softLavender, borderColor: softLavender, color: onAccent } : { borderColor: border, color: text }}
            >
              <Icon className="h-4 w-4" /> {name}
            </button>
          );
        })}
      </div>
      <div id="tool-panel" role="tabpanel" aria-labelledby={`tool-tab-${tool}`} className="mt-5 min-h-[15rem] break-words rounded-2xl p-4 sm:min-h-[16rem] sm:p-6" style={{ backgroundColor: surfaceMuted }}>
        <ToolOutput tool={tool} />
      </div>
      <p className="mt-4 text-xs opacity-70" style={{ color: softLavender }}>Sample output. REVI builds these from the reviewer you choose.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split row: text and checklist beside a visual                       */
/* ------------------------------------------------------------------ */
function SplitRow({
  id, title, text: body, points, cta, reverse = false, children,
}: {
  id: string;
  title: string;
  text: string;
  points: string[];
  cta: { label: string; icon: IconComponent; target: string };
  reverse?: boolean;
  children: ReactNode;
}) {
  const CtaIcon = cta.icon;
  return (
    <section id={id} className={`${wrap} scroll-mt-20 py-10 sm:py-14 lg:py-16`}>
      <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={`min-w-0 ${reverse ? 'lg:order-2' : ''}`}>
          <h2 className={`${display} text-[1.7rem] min-[400px]:text-[1.95rem] sm:text-[2.3rem] lg:text-[2.6rem]`}>{title}</h2>
          <p className="mt-5 max-w-md text-base leading-[1.7] opacity-75">{body}</p>
          <ul className="mt-7 grid gap-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] font-medium">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgb(var(--accent-lavender) / 0.18)', color: lavender }}>
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => jumpTo(cta.target)} className={buttonClasses('secondary', `mt-8 w-full px-6 py-3 sm:mt-9 sm:w-auto ${pill}`)}>
            <CtaIcon className="h-4 w-4" /> {cta.label}
          </button>
        </div>
        <div id={`${id}-demo`} className={`mx-auto w-full min-w-0 max-w-xl lg:max-w-none ${reverse ? 'lg:order-1' : ''}`}>{children}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Nav                                                                 */
/* ------------------------------------------------------------------ */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const targets = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          setActive((prev) => (entry.isIntersecting ? id : prev === id ? null : prev));
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}

function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
    };
  }, [open]);

  const isActive = (href: string) => active === href.slice(1);

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-[border-color] duration-300 ${
          scrolled || open ? 'border-border' : 'border-transparent'
        }`}
        style={{ backgroundColor: 'rgb(var(--background) / 0.8)' }}
      >
        <div className={`${wrap} grid h-16 grid-cols-[1fr_auto] items-center gap-3 sm:gap-4 lg:grid-cols-[1fr_auto_1fr]`}>
          <Link to="/" aria-label="REVI home" className={`justify-self-start rounded-control ${focusRing}`}><Logo /></Link>

          <nav aria-label="Primary" className="hidden items-center justify-self-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'location' : undefined}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-200 xl:px-3.5 motion-reduce:transition-none ${
                  isActive(link.href) ? 'bg-[rgb(var(--foreground)/0.12)] opacity-100' : 'opacity-70 hover:opacity-100'
                } ${focusRing}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center justify-self-end gap-2 lg:flex">
            <Link to="/login" className={buttonClasses('secondary', pill)}>
              <RightToBracket className="h-3.5 w-3.5" /> Log in
            </Link>
            <Link to="/login?mode=signup" className={buttonClasses('mint', pill)}>
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={`flex h-11 w-11 items-center justify-center justify-self-end rounded-full border border-border lg:hidden ${focusRing}`}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {open && (
        <>
          {/* Tapping the page outside the menu closes it. */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-[calc(4rem+env(safe-area-inset-top))] z-10 cursor-default bg-transparent lg:hidden"
          />
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-20 border-b border-t border-border px-5 pb-5 pt-3 shadow-2xl lg:hidden"
            style={{ backgroundColor: pageBg }}
          >
            <nav aria-label="Mobile" className="flex flex-col">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? 'location' : undefined}
                  className={`flex items-center justify-between rounded-control px-3 py-3.5 text-lg font-semibold ${focusRing}`}
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </a>
              ))}
            </nav>
            <div className="mt-3 grid gap-3 border-t border-border pt-4">
              <Link to="/login" onClick={() => setOpen(false)} className={buttonClasses('secondary', `w-full py-3 ${pill}`)}>
                <RightToBracket className="h-3.5 w-3.5" /> Log in
              </Link>
              <Link to="/login?mode=signup" onClick={() => setOpen(false)} className={buttonClasses('mint', `w-full py-3 ${pill}`)}>
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function LandingPage() {
  useForcedDarkTheme();
  const [cookiesOpen, setCookiesOpen] = useState<boolean>(() => getCookieConsent() === null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('no-scrollbar', 'scroll-smooth');
    const previousBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = MIDNIGHT_RGB;
    return () => {
      root.classList.remove('no-scrollbar', 'scroll-smooth');
      document.body.style.backgroundColor = previousBg;
    };
  }, []);

  const coreFeatures = features.slice(0, 3);
  const moreFeatures = features.slice(3);

  return (
    <div className="dark relative min-h-[100dvh] cursor-default select-none overflow-x-clip text-foreground [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_*]:caret-transparent [&_img]:pointer-events-none [&_img]:[-webkit-user-drag:none]" style={{ ...palette, backgroundColor: pageBg, backgroundImage: pageGradient }}>
      <Glow color={softLavender} className="-left-40 top-20 h-[26rem] w-[26rem]" />
      <Glow color={gold} className="-right-40 top-8 h-[24rem] w-[24rem]" />

      <SiteNav />

      <main className="relative">
        {/* Hero: centered on phones and tablets, left aligned beside the preview on desktop */}
        <section className={`${wrap} grid items-center gap-16 pb-14 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-24 lg:pt-20 xl:gap-20`}>
          <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
            <p
              className="mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold sm:mb-6 sm:text-sm"
              style={{
                borderColor: `color-mix(in srgb, ${pencilGold} 35%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${pencilGold} 12%, transparent)`,
                color: pencilGold,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> AI study tools for your own notes
            </p>
            <h1 className={`${display} text-[2.35rem] min-[400px]:text-[2.7rem] sm:text-[3.6rem] xl:text-[4.5rem]`}>
              Your ultimate study{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(100deg, ${gold} 10%, ${pencilGold} 90%)` }}>
                companion with REVI.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-[1.75] opacity-80 sm:text-lg">
              Upload your slides, PDFs, and notes. REVI builds summaries, flashcards, and timed quizzes from them, answers your questions in Study Chat, and shows how your study time is going.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start">
              <Link to="/login?mode=signup" className={buttonClasses('mint', `w-full px-7 py-3.5 text-base font-bold sm:w-auto ${pill} !bg-[linear-gradient(180deg,rgb(255_228_120),rgb(var(--revi-gold)))] shadow-[0_10px_28px_-10px_rgb(var(--revi-gold)/0.6)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgb(var(--revi-gold)/0.7)] motion-reduce:transform-none`)}>
                <Rocket className="h-4 w-4" /> Get started free
              </Link>
              <a href="#flashcards" className={buttonClasses('secondary', `w-full px-7 py-3.5 text-base sm:w-auto ${pill}`)}>
                <Layers className="h-4 w-4" /> Try a flashcard
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm opacity-75 lg:justify-start">
              {['Free to start', 'Private until you share', 'PDF, Word, PowerPoint'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5" style={{ color: pencilGold }} aria-hidden /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-lg px-3 sm:max-w-xl sm:px-0">
            <Glow color={lavender} className="left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2" />
            <div className="relative">
              {/* Index card stack behind the preview */}
              <span aria-hidden className="absolute inset-0 translate-x-3 translate-y-4 rotate-[4deg] rounded-3xl" style={{ backgroundColor: lavender }} />
              <span aria-hidden className="absolute inset-0 -translate-x-1 translate-y-2 -rotate-[2.5deg] rounded-3xl shadow-xl" style={indexCard} />
              <div className="relative rounded-3xl p-2 shadow-2xl" style={card}>
                <AppPreview />
              </div>
              <img
                src="/revi-mascot.png"
                alt="REVI, a penguin in glasses holding a notebook and a pencil"
                width={512}
                height={512}
                className="pointer-events-none absolute -bottom-9 -left-2 h-24 w-24 drop-shadow-xl min-[400px]:h-28 min-[400px]:w-28 sm:-bottom-10 sm:-left-10 sm:h-40 sm:w-40"
              />
              <div aria-hidden className="absolute -right-1 -top-6 hidden items-center gap-2.5 rounded-xl border px-3 py-2 shadow-lg min-[400px]:flex sm:-right-6" style={{ backgroundColor: surfaceRaised, borderColor: border }}>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: lavenderSurface }}>
                  <Stopwatch className="h-4 w-4" style={{ color: lavender }} />
                </span>
                <span>
                  <span className="block text-xs font-semibold">Timed quizzes</span>
                  <span className="block text-[11px] opacity-70">Graded on the server</span>
                </span>
              </div>
            </div>
            <p className="mt-16 text-center text-xs opacity-70 sm:mt-14" style={{ color: softLavender }}>Illustration of the workspace with sample numbers.</p>
          </div>
        </section>

        {/* Supported files: a quiet strip, no boxes */}
        <section aria-label="Supported files" className="border-y border-border" style={{ backgroundImage: 'linear-gradient(90deg, rgb(var(--revi-lavender) / 0.10), rgb(var(--revi-gold) / 0.06) 55%, rgb(var(--revi-lavender) / 0.10))' }}>
          <div className={`${wrap} flex flex-col gap-5 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:py-7`}>
            <div className="shrink-0">
              <p className="text-sm font-bold">Bring the files you already have</p>
              <p className="mt-1 text-xs opacity-60">Up to 10 MB each. AI tools read the text in PDF, Word, PowerPoint, and text files.</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-4 min-[480px]:grid-cols-3 sm:flex sm:flex-wrap sm:gap-x-8">
              {fileTypes.map((f, i) => (
                <li key={f.label} className="flex min-w-0 items-center gap-3">
                  <f.icon className="h-6 w-6 shrink-0" style={{ color: accents[i % accents.length] }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{f.label}</span>
                    <span className="block truncate text-[11px] opacity-60">{f.ext}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features: three core tools, then the rest as quiet rows */}
        <section id="features" className={`${wrap} scroll-mt-20 py-16 sm:py-20 lg:py-28`}>
          <SectionHeading title="Everything you need to review">
            From the first upload to review day, every tool works from your own material.
          </SectionHeading>

          <ul className="mt-10 grid gap-4 sm:mt-12 lg:grid-cols-3 lg:gap-5">
            {coreFeatures.map((f, i) => {
              const color = accents[i % accents.length];
              return (
                <li
                  key={f.title}
                  className="flex flex-col rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:transform-none sm:p-8"
                  style={{
                    borderColor: `color-mix(in srgb, ${color} 28%, ${border})`,
                    backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${color} 18%, ${surface}) 0%, ${surface} 72%)`,
                    boxShadow: `inset 0 1px 0 color-mix(in srgb, ${color} 35%, transparent)`,
                  }}
                >
                  <IconBadge icon={f.icon} color={color} size="lg" />
                  <h3 className={`${display} mt-8 text-[1.45rem] sm:text-[1.65rem]`}>{f.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.7] opacity-80">{f.text}</p>
                </li>
              );
            })}
          </ul>

          <ul className="mt-10 grid sm:mt-14 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-3 lg:gap-x-14">
            {moreFeatures.map((f, i) => (
              <li key={f.title} className="flex items-start gap-4 border-t border-border py-6">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accents[(i + 3) % accents.length] }} aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-[1.7] opacity-70">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <SplitRow
          id="tools"
          title="Study tools built from your reviewer"
          text="Pick a reviewer, pick a tool, and REVI generates it from the text in your files."
          points={[
            'Summary, key concepts, and plain-language explanations',
            'Flashcards saved as a deck you can study right away',
            'Quizzes with multiple-choice and true-or-false questions',
            'Study Chat answers based on the notes you pick',
          ]}
          cta={{ label: 'Try the sample', icon: Sparkles, target: 'tools-demo' }}
        >
          <ToolSwitcher />
        </SplitRow>

        <SplitRow
          id="flashcards"
          reverse
          title="Flashcards and quizzes that make it stick"
          text="Practice pulling answers from memory, which is what makes them stick. Flip a card, then rate yourself."
          points={[
            'Mark each card as got it or needs review',
            'Take quizzes with an optional time limit',
            'Read the explanation after you answer',
          ]}
          cta={{ label: 'Flip a card', icon: Layers, target: 'flashcards-demo' }}
        >
          <IndexCardDeck />
        </SplitRow>

        {/* Sharing: a scale from narrowest to widest reach */}
        <section id="sharing" className={`${wrap} scroll-mt-20 py-16 sm:py-20 lg:py-28`}>
          <SectionHeading title="You choose who sees each reviewer">
            Every reviewer starts private. Change its visibility any time, and the people it is shared with are notified when it changes.
          </SectionHeading>

          <div className="relative mt-12 sm:mt-14">
            <span
              aria-hidden
              className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px lg:block"
              style={{ backgroundImage: `linear-gradient(90deg, ${gold}, ${softLavender} 50%, ${orange})`, opacity: 0.55 }}
            />
            <ul className="relative grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
              {visibility.map((v, i) => (
                <li key={v.label} className="flex flex-col items-start lg:items-center lg:text-center">
                  <span className="rounded-2xl p-1.5" style={{ backgroundColor: pageBg }}>
                    <IconBadge icon={v.icon} color={accents[i % accents.length]} size="lg" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{v.label}</h3>
                  <p className="mt-1.5 max-w-[16rem] text-sm leading-relaxed opacity-75">{v.text}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 flex">
            <button type="button" onClick={() => jumpTo('how-it-works')} className={buttonClasses('secondary', `px-6 py-3 ${pill}`)}>
              <ChevronDown className="h-4 w-4" /> See how it works
            </button>
          </div>
        </section>

        {/* How it works: a real sequence, so numbered and connected */}
        <section id="how-it-works" className={`${wrap} scroll-mt-20 pb-16 sm:pb-20 lg:pb-28`}>
          <SectionHeading title="How a study session goes" />
          <ol className="mt-12 grid gap-10 sm:mt-14 lg:grid-cols-3 lg:gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="min-w-0">
                  <div className="flex items-center gap-4">
                    <span
                      className={`${display} flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl`}
                      style={{ backgroundColor: accents[i], color: onAccent }}
                    >
                      {i + 1}
                    </span>
                    {/* Dashed line from the number to the icon, drawn for every step. */}
                    <span
                      aria-hidden
                      className="hidden h-0 min-w-[1.5rem] flex-1 border-t border-dashed lg:block"
                      style={{ borderColor: 'rgb(var(--foreground) / 0.3)' }}
                    />
                    <Icon className="ml-auto h-5 w-5 shrink-0 opacity-70" aria-hidden />
                  </div>
                  <h3 className={`${display} mt-6 text-2xl`}>{step.title}</h3>
                  <p className="mt-3 max-w-sm text-[15px] leading-[1.7] opacity-80">{step.text}</p>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Final call to action: one ruled index card. Centered on phones, side by side from 640px up. */}
        <section className={`${wrap} relative pb-16 sm:pb-24`}>
          <div className="relative mx-auto max-w-4xl">
            <Glow color={gold} className="left-1/2 top-1/2 h-80 w-[36rem] max-w-full -translate-x-1/2 -translate-y-1/2" />
            <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-3 rotate-[1.5deg] rounded-3xl" style={{ backgroundImage: `linear-gradient(120deg, ${lavender}, ${gold})` }} />
            <div className="relative overflow-hidden rounded-3xl px-6 pb-12 pt-10 text-center shadow-2xl sm:px-12 sm:py-16 sm:text-left lg:px-16" style={indexCard}>
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                <div className="flex min-w-0 flex-col items-center sm:items-start">
                  <h2 className={`${display} max-w-xl text-[1.85rem] min-[400px]:text-[2.1rem] sm:text-[2.6rem] lg:text-[3rem]`}>
                    Bring your notes. Leave with flashcards.
                  </h2>
                  <p className="mt-5 max-w-md text-base leading-[1.7] opacity-80 sm:text-lg">
                    Create a free account, upload one reviewer, and generate your first set of flashcards.
                  </p>
                  <div className="mt-8 flex w-full justify-center sm:w-auto sm:justify-start">
                    <Link to="/login?mode=signup" className={buttonClasses('primary', `w-full px-8 py-3.5 text-base sm:w-auto ${onCreamPrimary}`)}>
                      <Rocket className="h-4 w-4" /> Create free account
                    </Link>
                  </div>
                </div>
                <img
                  src="/revi-avatar.png"
                  alt=""
                  width={512}
                  height={512}
                  className="order-first h-44 w-44 shrink-0 rounded-full min-[400px]:h-52 min-[400px]:w-52 sm:order-last sm:h-52 sm:w-52 lg:h-72 lg:w-72"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-[linear-gradient(180deg,rgb(var(--surface)/0.85),rgb(var(--background)/0.85))] backdrop-blur-md xl:max-w-7xl">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--revi-lavender)/0.6),rgb(var(--revi-gold)/0.6),transparent)]" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-5 sm:p-10 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-14">
            <div className="col-span-2 flex max-w-sm flex-col items-start gap-4 lg:col-span-1">
              <Logo />
              <p className="text-sm leading-[1.7] opacity-75">
                Reviewers, flashcards, quizzes, and study progress in one place, built from your own notes.
              </p>
            </div>

            <nav aria-label="Footer">
              <h2 className="text-sm font-bold" style={{ color: pencilGold }}>Explore</h2>
              <ul className="mt-4 grid gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={`inline-block rounded py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100 motion-reduce:transition-none ${focusRing}`}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <h2 className="text-sm font-bold" style={{ color: pencilGold }}>Account</h2>
              <ul className="mt-4 grid gap-1">
                <li>
                  <Link to="/login" className={`inline-block rounded py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100 motion-reduce:transition-none ${focusRing}`}>
                    Log in
                  </Link>
                </li>
                <li>
                  <Link to="/login?mode=signup" className={`inline-block rounded py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100 motion-reduce:transition-none ${focusRing}`}>
                    Create account
                  </Link>
                </li>
                <li>
                  <button type="button" onClick={() => setCookiesOpen(true)} className={`inline-block rounded py-1.5 text-sm opacity-75 transition-opacity hover:opacity-100 motion-reduce:transition-none ${focusRing}`}>
                    Cookie settings
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end border-t border-border px-5 py-4 text-right text-xs sm:px-10">
            <span className="opacity-70">© {new Date().getFullYear()} REVI. All rights reserved.</span>
          </div>
        </div>
      </footer>

      <CookieBanner open={cookiesOpen} onClose={() => setCookiesOpen(false)} />
    </div>
  );
}