import { Link } from 'react-router-dom';
import { Globe, Lock, Share2, Users } from '../../icons';
import type { Reviewer, Visibility } from '../../types/database';
import { formatDate } from '../../lib/format';
import { Button } from '../common/Button';
import { VISIBILITY_OPTIONS } from './ReviewerForm';

const visibilityIcon: Record<Visibility, typeof Lock> = { private: Lock, friends: Users, shared: Share2, public: Globe };

export function VisibilityPill({ value }: { value: Visibility }) {
  const Icon = visibilityIcon[value];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
      <Icon className="h-3 w-3" aria-hidden />
      {VISIBILITY_OPTIONS[value].label}
    </span>
  );
}

interface ReviewerCardProps {
  reviewer: Reviewer;
  fileCount: number;
  ownerLabel?: string;
  isOwner: boolean;
  saved: boolean;
  savePending?: boolean;
  view: 'grid' | 'list';
  onToggleSave?: () => void;
}

export function ReviewerCard({ reviewer, fileCount, ownerLabel, isOwner, saved, savePending = false, view, onToggleSave }: ReviewerCardProps) {
  const layout = view === 'list' ? 'flex-row items-center' : 'flex-col';
  return (
    <article className={`flex gap-4 rounded-card border border-border bg-surface p-5 shadow-sm ${layout}`}>
      <div className="min-w-0 flex-1">
        <Link to={`/reviewers/${reviewer.id}`} className="block truncate text-base font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {reviewer.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {reviewer.subject && (
            <span className="rounded-full bg-lavender-surface px-2.5 py-0.5 text-xs font-medium">{reviewer.subject}</span>
          )}
          <VisibilityPill value={reviewer.visibility} />
          {reviewer.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted">#{tag}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {fileCount} {fileCount === 1 ? 'file' : 'files'} · Updated {formatDate(reviewer.updated_at)}
          {!isOwner && ownerLabel ? ` · by ${ownerLabel}` : ''}
        </p>
      </div>
      {!isOwner && onToggleSave && (
        <Button
          variant={saved ? 'mint' : 'secondary'}
          onClick={onToggleSave}
          loading={savePending}
          aria-pressed={saved}
          className="shrink-0"
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
      )}
    </article>
  );
}
