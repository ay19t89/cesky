import type { Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

type SessionChanged = (session: Session | null, changed: boolean) => void;

export function createPageAuth() {
  let session = $state<Session | null>(null);
  let ready = $state(false);
  let loginOpen = $state(false);
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  function initialize(onSessionChanged: SessionChanged): () => void {
    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      ready = true;
      onSessionChanged(session, true);
    });

    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => {
      const changed = session?.user.id !== nextSession?.user.id;
      session = nextSession;
      ready = true;
      onSessionChanged(session, changed);
    });

    return () => data.subscription.unsubscribe();
  }

  async function signIn(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      const response = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (response.error) throw response.error;
      password = '';
      loginOpen = false;
    } catch {
      error =
        'Přihlášení se nezdařilo. Zkontrolujte e-mail, heslo a připojení.';
    } finally {
      busy = false;
    }
  }

  async function signOut(): Promise<boolean> {
    const response = await supabase.auth.signOut();
    return !response.error;
  }

  return {
    get session() {
      return session;
    },
    get ready() {
      return ready;
    },
    get loginOpen() {
      return loginOpen;
    },
    set loginOpen(value: boolean) {
      loginOpen = value;
    },
    get email() {
      return email;
    },
    set email(value: string) {
      email = value;
    },
    get password() {
      return password;
    },
    set password(value: string) {
      password = value;
    },
    get error() {
      return error;
    },
    get busy() {
      return busy;
    },
    initialize,
    signIn,
    signOut
  };
}
