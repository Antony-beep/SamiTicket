"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type SessionUser = { email?: string | null } | null;

export function AuthControl() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<SessionUser>(null);
  const [ready, setReady] = useState(() => !configured);

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => subscription.subscription.unsubscribe();
  }, [configured]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.replace("/");
    router.refresh();
  }

  if (!ready) return <span className="session-loading">Cargando…</span>;
  if (!user) return <Link className="button button-dark" href="/login">Ingresar</Link>;

  return (
    <div className="session-menu">
      <Link href="/panel">Mi panel</Link>
      <span title={user.email ?? undefined}>{user.email ?? "Sesión iniciada"}</span>
      <button type="button" onClick={signOut}>Cerrar sesión</button>
    </div>
  );
}
