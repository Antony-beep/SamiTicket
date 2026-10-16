import 'server-only';
import { redirect } from 'next/navigation';
import { actor } from './data';
import { AppError } from '@/lib/validation';
import { connection } from 'next/server';

export async function pageActor(next: string) {
  await connection();
  try { return await actor(); }
  catch (error) {
    if (error instanceof AppError && error.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
    throw error;
  }
}

export async function pageData<T>(load: () => Promise<T>): Promise<{ data: T; error?: never } | { data?: never; error: string }> {
  try { return { data: await load() }; }
  catch (error) { return { error: error instanceof AppError ? error.message : 'No pudimos cargar los datos. Reintenta.' }; }
}
