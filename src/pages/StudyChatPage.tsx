import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send, Trash2 } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { clearChat, listChatMessages, sendChatMessage } from '../services/chat';
import { listReviewers } from '../services/reviewers';
import { FunctionError } from '../lib/functions';
import { errorMessage } from '../lib/format';
import { Alert, inputClass, selectClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Skeleton } from '../components/common/Skeleton';

const SUGGESTIONS = [
  'Explain the main ideas in my reviewer',
  'Quiz me with three questions',
  'Help me make a three-day study plan',
  'Explain this like I am new to the topic',
];

export default function StudyChatPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const [reviewerId, setReviewerId] = useState(params.get('reviewer') ?? '');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({ queryKey: ['chat', userId], queryFn: () => listChatMessages(userId), enabled: !!userId });
  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });
  const allMessages = messagesQuery.data ?? [];
  const messages = allMessages.filter((m) => (m.reviewer_id ?? '') === reviewerId);
  const reviewers = reviewersQuery.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setDraft('');
    setPending(message);
    try {
      await sendChatMessage(message, reviewerId || undefined);
      await queryClient.invalidateQueries({ queryKey: ['chat', userId] });
    } catch (err) {
      setDraft(message);
      setError({
        message: errorMessage(err),
        notConfigured: err instanceof FunctionError && err.code === 'AI_NOT_CONFIGURED',
      });
    } finally {
      setPending(null);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // On phones and tablets Enter adds a new line; the Send button sends.
    if (window.matchMedia?.('(pointer: coarse)').matches) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  }

  async function onClear() {
    setClearing(true);
    try {
      await clearChat(userId);
      queryClient.invalidateQueries({ queryKey: ['chat', userId] });
      setConfirmClear(false);
    } catch (err) {
      setError({ message: errorMessage(err), notConfigured: false });
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col gap-4 md:h-[calc(100dvh-7rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Study chat</h1>
          <p className="mt-1 text-sm text-muted">Ask questions, get explanations, or plan your review.</p>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <label htmlFor="chat-reviewer" className="sr-only">Use a reviewer as context</label>
          <select
            id="chat-reviewer"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            className={`${selectClass} min-w-0 flex-1 sm:max-w-[240px] sm:flex-none`}
          >
            <option value="">No reviewer context</option>
            {reviewers.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setConfirmClear(true)} disabled={allMessages.length === 0} aria-label="Clear chat">
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </header>

      <section
        aria-label="Conversation"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-4 shadow-sm md:p-6"
      >
        {messagesQuery.isLoading && <Skeleton className="h-24 w-full" />}
        {messagesQuery.isError && <Alert>Couldn't load your chat: {errorMessage(messagesQuery.error)}</Alert>}

        {!messagesQuery.isLoading && messages.length === 0 && !pending && (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 py-4 text-center sm:gap-5 sm:py-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender-surface">
              <MessageSquare className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Start a conversation</p>
              <p className="mt-1 text-sm text-muted">Pick a reviewer above to base answers on your notes.</p>
            </div>
            <div className="flex w-full max-w-md flex-col gap-2 sm:max-w-2xl sm:flex-row sm:flex-wrap sm:justify-center">
              {SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => send(text)}
                  className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-2.5 text-left text-sm leading-snug transition-colors hover:border-brand/50 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:w-auto sm:rounded-full sm:py-1.5 sm:text-center"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed md:max-w-[75%] ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {pending && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground md:max-w-[75%]">{pending}</div>
            </div>
            <div className="flex justify-start">
              <div className="rounded-2xl bg-surface-muted px-4 py-2.5 text-sm text-muted" role="status">Thinking…</div>
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </section>

      {error && (
        <Alert>
          {error.notConfigured
            ? 'The study assistant is not set up for this project yet. The project owner needs to add the AI provider key and model as Edge Function secrets.'
            : error.message}
        </Alert>
      )}

      <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(draft); }} className="flex shrink-0 items-end gap-2 pb-1">
        <label htmlFor="chat-input" className="sr-only">Message</label>
        <textarea
          id="chat-input"
          rows={2}
          maxLength={4000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about a concept, quiz, or study plan"
          className={`${inputClass} min-w-0 flex-1 resize-none`}
        />
        <Button type="submit" disabled={!draft.trim() || !!pending} aria-label="Send message" className="h-11 shrink-0 px-3.5 sm:px-4">
          <Send className="h-4 w-4" aria-hidden /> <span className="hidden min-[380px]:inline">Send</span>
        </Button>
      </form>
      <p className="-mt-2 hidden text-xs text-muted md:block">Enter sends, Shift+Enter adds a line.</p>

      <ConfirmDialog
        open={confirmClear}
        title="Clear this chat?"
        description="All of your chat messages, across every reviewer, will be deleted. This can't be undone."
        confirmLabel="Clear chat"
        danger
        loading={clearing}
        onConfirm={onClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
