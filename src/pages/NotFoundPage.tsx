import { Link } from 'react-router-dom';
import { buttonClasses } from '../components/common/Button';
import { Logo } from '../components/common/Logo';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <div>
        <p className="text-sm text-muted">Error 404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">This page doesn't exist</h1>
      </div>
      <Link to="/" className={buttonClasses('primary')}>Back to home</Link>
    </main>
  );
}
