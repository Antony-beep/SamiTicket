'use client';
import { AppError } from '@/lib/validation';
export function focusError(form: HTMLFormElement | null, errors: Record<string, string>) {
  const first = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[aria-invalid="true"]');
  if (first) first.focus();
  else if (form) {
    const key = Object.keys(errors)[0];
    form.querySelector<HTMLInputElement>(`[data-field="${key}"]`)?.focus();
  }
}
export function fieldErrors(error: unknown) { return error instanceof AppError ? error.errors ?? {} : {}; }
export function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? <p className="field-error" id={`${name}-error`}>{errors[name]}</p> : null;
}
