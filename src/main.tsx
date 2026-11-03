import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import './index.css';
import { RevLoader } from './components/common/RevLoader';

/** Shortest time the loading screen stays up, so it's seen before the landing page appears. */
const SPLASH_MIN_MS = 1200;

const root = ReactDOM.createRoot(document.getElementById('root')!);

function showProblem(title: string, detail: string) {
  root.render(
    <main style={{ maxWidth: 560, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#F8F5EC', background: '#201F29', minHeight: '100vh', boxSizing: 'border-box', lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>{title}</h1>
      <p style={{ whiteSpace: 'pre-wrap' }}>{detail}</p>
    </main>,
  );
}

// Read each variable by name. A computed key (import.meta.env[key]) would make Vite embed every VITE_ variable in the bundle.
const missing = [
  !import.meta.env.VITE_SUPABASE_URL && 'VITE_SUPABASE_URL',
  !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter((key): key is string => Boolean(key));

if (missing.length > 0) {
  showProblem(
    'REVI needs its Supabase settings',
    `Missing in your .env file: ${missing.join(', ')}.\n\n1. Copy .env.example to .env (in the project root, next to package.json).\n2. Fill in your Supabase project URL and publishable key.\n3. Stop the dev server and run npm run dev again.`,
  );
} else {
  // Show the loading screen first, then load the app. The app appears only after both
  // the modules have loaded and the splash has been up for SPLASH_MIN_MS.
  // The splash is for phones and tablets only. Desktop and laptop screens skip it.
  const isSmallScreen = window.matchMedia('(max-width: 1023px)').matches;
  if (isSmallScreen) root.render(<RevLoader fullPage label="Loading REVI" />);
  const splashDone = isSmallScreen
    ? new Promise<void>((resolve) => setTimeout(resolve, SPLASH_MIN_MS))
    : Promise.resolve();

  Promise.all([
    Promise.all([
      import('react-router-dom'),
      import('@tanstack/react-query'),
      import('./App'),
      import('./contexts/AuthContext'),
      import('./contexts/ThemeContext'),
      import('./components/common/Toast'),
    ]),
    splashDone,
  ])
    .then(([[{ BrowserRouter }, { QueryClient, QueryClientProvider }, { default: App }, { AuthProvider }, { ThemeProvider }, { ToastProvider }]]) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      });
      root.render(
        <React.StrictMode>
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <ToastProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </ToastProvider>
              </AuthProvider>
            </QueryClientProvider>
          </ThemeProvider>
        </React.StrictMode>,
      );
    })
    .catch((err: unknown) => {
      console.error(err);
      showProblem('REVI failed to start', err instanceof Error ? err.message : String(err));
    });
}
