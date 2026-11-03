import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AtSign, Calendar, CheckCircle2, CircleAlert, GraduationCap, KeyRound, Mail, Pencil, School, User } from '../icons';
import type { IconComponent } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { getMyProfile } from '../services/social';
import { displayName } from '../lib/user';
import { UserAvatar } from '../components/common/UserAvatar';
import { errorMessage, formatDate, formatDateTime } from '../lib/format';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { buttonClasses } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';

/** Label and value sit side by side on wide screens and stack on phones so long emails stay readable. */
function Row({ icon: Icon, iconClassName, label, value }: { icon: IconComponent; iconClassName?: string; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="flex shrink-0 items-center gap-2 text-sm text-muted">
        <Icon className={`h-4 w-4 ${iconClassName ?? ''}`} aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium sm:text-right">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const profileQuery = useQuery({
    queryKey: ['my-profile', userId],
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const profile = profileQuery.data;

  const provider = (user?.app_metadata?.provider as string | undefined) ?? 'email';
  const providerLabel = provider === 'google' ? 'Google' : 'Email and password';
  const verified = !!user?.email_confirmed_at;
  const name = profile?.full_name?.trim() || displayName(user);

  return (
    <div className="mx-auto max-w-4xl space-y-5 md:space-y-6">
      <header className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <div aria-hidden className="h-24 bg-[linear-gradient(115deg,rgb(var(--revi-soft-navy))_0%,rgb(var(--revi-lavender))_65%,rgb(var(--revi-gold))_100%)] sm:h-32" />
        <div className="flex flex-col items-center gap-4 px-5 pb-5 text-center sm:flex-row sm:items-end sm:px-6 sm:pb-6 sm:text-left">
          <div className="-mt-12 shrink-0 rounded-full bg-surface p-1 ring-4 ring-surface sm:-mt-14">
            <UserAvatar url={profile?.avatar_url} name={name} size="h-24 w-24 sm:h-28 sm:w-28" />
          </div>
          <div className="min-w-0 flex-1 sm:pb-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="break-words text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">{name}</h1>
              {verified && (
                <span className="inline-flex items-center" title="Verified email" role="img" aria-label="Verified email">
                  <CheckCircle2 className="h-5 w-5 text-[#1877F2]" aria-hidden />
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">{profile?.username ? `@${profile.username}` : 'No username yet'}</p>
            {(profile?.school || profile?.course) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {profile?.school && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-lavender-surface px-3 py-1 text-xs font-medium">
                    <School className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{profile.school}</span>
                  </span>
                )}
                {profile?.course && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-lavender-surface px-3 py-1 text-xs font-medium">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" aria-hidden /> <span className="truncate">{profile.course}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <Link to="/settings" className={`${buttonClasses('secondary')} w-full sm:w-auto`}>
            <Pencil className="h-4 w-4" aria-hidden /> Edit profile
          </Link>
        </div>
      </header>

      {profileQuery.isError && <Alert>Couldn't load your profile details: {errorMessage(profileQuery.error)}</Alert>}
      {!profileQuery.isLoading && !profileQuery.isError && !profile && (
        <Alert tone="info">Your profile details haven't been created yet. Open Edit profile to add them.</Alert>
      )}

      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        <Card title="Account" description="How you sign in and when you joined">
          {!user ? <Skeleton className="h-40 w-full" /> : (
            <dl className="divide-y divide-border">
              <Row icon={Mail} label="Email" value={user.email ?? 'Not available'} />
              <Row icon={verified ? CheckCircle2 : CircleAlert} iconClassName={verified ? 'text-[#1877F2]' : undefined} label="Email status" value={verified ? 'Verified' : 'Not verified'} />
              <Row icon={KeyRound} label="Sign-in method" value={providerLabel} />
              <Row icon={Calendar} label="Member since" value={user.created_at ? formatDate(user.created_at) : '—'} />
              <Row icon={Calendar} label="Last sign-in" value={user.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : '—'} />
            </dl>
          )}
        </Card>

        <Card title="Profile" description="Shown to friends you connect with">
          {profileQuery.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <dl className="divide-y divide-border">
              <Row icon={User} label="Full name" value={profile?.full_name || 'Not set'} />
              <Row icon={AtSign} label="Username" value={profile?.username ? `@${profile.username}` : 'Not set'} />
              <Row icon={School} label="School" value={profile?.school || 'Not set'} />
              <Row icon={GraduationCap} label="Course" value={profile?.course || 'Not set'} />
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}