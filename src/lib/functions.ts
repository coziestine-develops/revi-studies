import { supabase } from './supabase';

export class FunctionError extends Error {
  code?: string;
  status?: number;
}

/** Calls a Supabase Edge Function and surfaces the server's error message and code. */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
      const failure = new FunctionError(
        `Couldn't reach the "${name}" function. Deploy it with "supabase functions deploy ${name}", then check that its secrets are set.`,
      );
      throw failure;
    }
    const failure = new FunctionError(error.message);
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      failure.status = response.status;
      try {
        const payload = (await response.json()) as { error?: string; code?: string };
        if (payload.error) failure.message = payload.error;
        failure.code = payload.code;
      } catch {
        // The body wasn't JSON; keep the generic message.
      }
    }
    throw failure;
  }
  return data as T;
}
