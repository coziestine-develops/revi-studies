import { BarChart3, BookOpen, Check, ClipboardCheck, Compass, FolderOpen, Layers, LayoutDashboard, Sparkles } from '../../icons';
import { LogoMark } from '../common/Logo';

/**
 * A static recreation of the REVI workspace for the public site.
 * It shows sample figures only and is hidden from assistive tech; real data lives in the app.
 */
const nav = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: BookOpen, label: 'My Reviewers' },
  { icon: Compass, label: 'Discover' },
  { icon: FolderOpen, label: 'Collections' },
  { icon: Layers, label: 'Flashcards' },
  { icon: ClipboardCheck, label: 'Quizzes' },
  { icon: BarChart3, label: 'Analytics' },
];

const reviewers = [
  { title: 'Cell Biology: Midterm', subject: 'Biology', tone: 'bg-mint-surface' },
  { title: 'Macroeconomics Notes', subject: 'Economics', tone: 'bg-lavender-surface' },
  { title: 'Data Structures Recap', subject: 'Computer Science', tone: 'bg-surface-muted' },
];

const bars = [35, 55, 40, 70, 60, 85, 50];
const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function AppPreview({ full = false }: { full?: boolean }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-card border border-border bg-background shadow-xl">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-error/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint" />
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[150px_minmax(0,1fr)]">
        <div className="hidden rounded-control bg-sidebar p-3 sm:block">
          <div className="mb-3 flex items-center gap-2">
            <LogoMark alt="" size="sm" />
            <span className="font-display text-sm font-extrabold">REVI</span>
          </div>
          <ul className="space-y-1">
            {nav.slice(0, full ? 7 : 5).map((item) => (
              <li
                key={item.label}
                className={`flex items-center gap-2 rounded-control px-2 py-1.5 text-[11px] font-medium ${item.active ? 'bg-primary text-primary-foreground' : 'text-muted'}`}
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden /> {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-2 min-w-0 space-y-3 sm:col-span-1">
          <div className="grid grid-cols-3 gap-2">
            {[['12', 'Reviewers'], ['86%', 'Quiz average'], ['5.5 h', 'Study time']].map(([value, label]) => (
              <div key={label} className="min-w-0 rounded-control border border-border bg-surface p-2 sm:p-2.5">
                <p className="truncate text-sm font-bold sm:text-lg">{value}</p>
                <p className="text-[11px] leading-tight text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className={`grid gap-3 ${full ? 'md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]' : ''}`}>
            <div className="rounded-control border border-border bg-surface p-3">
              <p className="mb-2 text-xs font-semibold">Recent reviewers</p>
              <ul className="space-y-2">
                {reviewers.map((item) => (
                  <li key={item.title} className="flex items-center gap-2.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control ${item.tone}`}>
                      <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium">{item.title}</span>
                      <span className="block text-[11px] text-muted">{item.subject}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-control border border-border bg-surface p-3">
              <p className="mb-2 text-xs font-semibold">Weekly study activity</p>
              <div className="flex h-20 items-end gap-1.5">
                {bars.map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div className={`w-full rounded-t ${index === 5 ? 'bg-lavender' : 'bg-mint'}`} style={{ height: `${Math.round(height * 0.6)}px` }} />
                    <span className="text-[10px] text-muted">{days[index]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {full && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-control border border-border bg-lavender-surface p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold"><Layers className="h-3.5 w-3.5" aria-hidden /> Flashcard 3 of 20</p>
                <p className="mt-2 text-sm font-semibold">What does the mitochondrion produce?</p>
                <div className="mt-3 h-1.5 rounded-full bg-surface"><div className="h-full w-[15%] rounded-full bg-lavender" /></div>
              </div>
              <div className="rounded-control border border-border bg-mint-surface p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold"><ClipboardCheck className="h-3.5 w-3.5" aria-hidden /> Quiz result</p>
                <p className="mt-2 text-sm font-semibold">9 of 10 correct</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Check className="h-3 w-3 text-success" aria-hidden /> Explanations saved to history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FloatingChip({ icon: Icon, title, detail, className = '' }: { icon: typeof Sparkles; title: string; detail: string; className?: string }) {
  return (
    <div aria-hidden className={`absolute flex items-center gap-2.5 rounded-control border border-border bg-surface px-3 py-2 shadow-lg ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-control bg-lavender-surface">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-xs font-semibold">{title}</span>
        <span className="block text-[11px] text-muted">{detail}</span>
      </span>
    </div>
  );
}
