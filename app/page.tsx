'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  Download,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SUPABASE_URL } from '@/lib/config';
import { compareCzechWords, exportData } from '@/lib/exports';
import { ijpUrlForWord } from '@/lib/ijp-url';
import { suggest } from '@/lib/suggestions';
import { supabase } from '@/lib/supabase';
import {
  caseNames,
  genders,
  questions,
  type Lookup,
  type Saved,
  type Source,
} from '@/lib/types';
import { registerLookup } from '@/lib/webmcp';

type ApiResponse = Lookup & {
  suggestions?: string[];
  error?: string;
  message?: string;
};

function dictionaryEndpoint(): string {
  const isPagesBuild =
    typeof window !== 'undefined' &&
    (window as unknown as { PAGES_BUILD?: boolean }).PAGES_BUILD;

  return isPagesBuild
    ? `${SUPABASE_URL}/functions/v1/dictionary`
    : '/api/dictionary';
}

async function dictionaryRequest(
  word: string,
  action = 'lookup',
  signal?: AbortSignal,
): Promise<ApiResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Pro ověření se přihlaste ke svému slovníku.');
  }

  const query = new URLSearchParams({ word, action });
  const response = await fetch(`${dictionaryEndpoint()}?${query}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    signal,
  });
  const json = (await response.json().catch(() => ({
    error: 'Služba není dostupná. Ověřte nasazení funkce dictionary.',
  }))) as ApiResponse;

  if (!response.ok) {
    throw new Error(json.error || json.message || 'Ověření se nezdařilo.');
  }

  return json;
}

function SourceTitle({ source }: { source: Source }) {
  const sourceUrl = ijpUrlForWord(source.entries[0]?.lemma || '');
  const status =
    source.status === 'ok'
      ? 'Načteno'
      : source.status === 'error'
        ? 'Nedostupné'
        : 'Nenalezeno';

  return (
    <div className="sourceheading singlesource">
      <span className={`dot ${source.status === 'ok' ? 'ok' : 'warn'}`} />
      <a
        href={source.entries.length ? sourceUrl : source.url}
        target="_blank"
        rel="noreferrer"
      >
        Internetová jazyková příručka <ArrowUpRight size={14} />
      </a>
      <small>{status}</small>
    </div>
  );
}

function FormCell({
  source,
  number,
  index,
}: {
  source: Source;
  number: 'singular' | 'plural';
  index: number;
}) {
  if (!source.entries.length) {
    return <span className="missing">—</span>;
  }

  return (
    <>
      {source.entries.map((entry, entryIndex) => (
        <div key={entryIndex} className="formvariant">
          {source.entries.length > 1 && (
            <small className="sense">
              {entry.lemma} ·{' '}
              {entry.gender ? genders[entry.gender] : 'Rod neurčen'}
            </small>
          )}
          {entry[number][index]?.join(', ') || (
            <span className="missing">—</span>
          )}
        </div>
      ))}
    </>
  );
}

function DeclensionTable({ result }: { result: Lookup }) {
  return (
    <>
      <div className="sourcegrid sourcegrid-single">
        <SourceTitle source={result.ijp} />
      </div>

      <div className="comparison comparison-single">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pád a otázka</TableHead>
              <TableHead>Jednotné číslo</TableHead>
              <TableHead>Množné číslo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {caseNames.map((name, index) => (
              <TableRow key={name}>
                <TableCell>
                  <div className="casecell">
                    <b>{index + 1}</b>
                    <div>
                      <strong>{name}</strong>
                      <small>{questions[index]}</small>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <FormCell
                    source={result.ijp}
                    number="singular"
                    index={index}
                  />
                </TableCell>
                <TableCell>
                  <FormCell source={result.ijp} number="plural" index={index} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.ijp.message && <p className="notice">{result.ijp.message}</p>}
    </>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [word, setWord] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<Lookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedBusy, setSavedBusy] = useState(false);
  const [savedError, setSavedError] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentSaved, setCurrentSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState('lookup');
  const [gender, setGender] = useState('all');

  const requestId = useRef(0);
  const activeUser = useRef<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    const userId = activeUser.current;
    if (!userId) return;

    setSavedBusy(true);
    setSavedError('');

    try {
      const rows: Saved[] = [];

      for (let offset = 0; ; offset += 500) {
        const { data, error: databaseError } = await supabase
          .from('czech_words')
          .select('id,word,result,updated_at')
          .order('updated_at', { ascending: false })
          .range(offset, offset + 499);

        if (databaseError) throw databaseError;
        rows.push(...(data as Saved[]));
        if (data.length < 500) break;
      }

      if (activeUser.current === userId) {
        setSaved(rows);
      }
    } catch {
      if (activeUser.current === userId) {
        setSavedError(
          'Slovník nelze načíst. Zkontrolujte připojení a nastavení Supabase.',
        );
      }
    } finally {
      if (activeUser.current === userId) {
        setSavedBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    activeUser.current = session?.user.id;
    requestId.current += 1;
    setBusy(false);
    setResult(null);
    setCurrentSaved(false);
    setSaved([]);
    setSavedError('');
    setMessage('');

    if (session) void refresh();
  }, [session?.user.id, refresh]);

  useEffect(() => {
    const localSuggestions = suggest(
      word,
      saved.map((item) => item.word),
    );
    setSuggestions(localSuggestions);

    if (!session || word.trim().length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      dictionaryRequest(word.trim(), 'suggest', controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setSuggestions(
              [
                ...new Set([...(data.suggestions || []), ...localSuggestions]),
              ].slice(0, 8),
            );
          }
        })
        .catch(() => {});
    }, 650);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [word, saved, session?.user.id]);

  const check = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        throw new Error('Zadejte slovo.');
      }

      if (!session) {
        setLoginOpen(true);
        throw new Error('Pro ověření se přihlaste.');
      }

      const currentRequest = ++requestId.current;
      setBusy(true);
      setError('');
      setMessage('');
      setCurrentSaved(false);
      setView('lookup');

      try {
        const data = await dictionaryRequest(value);

        if (currentRequest === requestId.current) {
          setResult(data);
          setWord(data.word);
        }

        if (!data.ijp.entries.length) {
          return data;
        }

        const { error: databaseError } = await supabase
          .from('czech_words')
          .upsert(
            {
              word: data.word,
              result: data,
              user_id: session.user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,word' },
          );

        if (databaseError) {
          if (currentRequest === requestId.current) {
            setError(
              'Slovo bylo ověřeno, ale nepodařilo se ho automaticky uložit.',
            );
          }
        } else {
          if (currentRequest === requestId.current) {
            setCurrentSaved(true);
            setMessage('Slovo bylo automaticky uloženo.');
          }
          await refresh();
        }

        return data;
      } catch (lookupError) {
        if (currentRequest === requestId.current) {
          setError(
            lookupError instanceof Error
              ? lookupError.message
              : 'Ověření se nezdařilo.',
          );
        }
        throw lookupError;
      } finally {
        if (currentRequest === requestId.current) {
          setBusy(false);
        }
      }
    },
    [session, refresh],
  );

  useEffect(() => registerLookup(check), [check]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      setPassword('');
      setLoginOpen(false);
    } catch {
      setAuthError(
        'Přihlášení se nezdařilo. Zkontrolujte e-mail, heslo a připojení.',
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function toggleSaved() {
    if (!result || !session) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (currentSaved) {
        const { error: databaseError } = await supabase
          .from('czech_words')
          .delete()
          .eq('user_id', session.user.id)
          .eq('word', result.word);

        if (databaseError) throw databaseError;
        setCurrentSaved(false);
        setMessage('Slovo bylo odebráno ze slovníku.');
      } else {
        const { error: databaseError } = await supabase
          .from('czech_words')
          .upsert(
            {
              word: result.word,
              result,
              user_id: session.user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,word' },
          );

        if (databaseError) throw databaseError;
        setCurrentSaved(true);
        setMessage('Slovo bylo uloženo do slovníku.');
      }

      await refresh();
    } catch {
      setError('Změnu se nepodařilo uložit. Zkontrolujte připojení.');
    } finally {
      setSaving(false);
    }
  }

  const visibleSaved = saved
    .filter(
      (item) =>
        gender === 'all' ||
        item.result.ijp.entries.some((entry) => entry.gender === gender),
    )
    .sort((left, right) => compareCzechWords(left.word, right.word));

  async function runExport(format: 'csv' | 'xlsx' | 'pdf') {
    setExporting(true);
    setError('');

    try {
      const results =
        view === 'saved'
          ? visibleSaved.map((item) => item.result)
          : result
            ? [result]
            : [];
      await exportData(format, results);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Export se nezdařil.',
      );
    } finally {
      setExporting(false);
    }
  }

  const exportButtons = (
    <div className="exports">
      <Download size={16} />
      {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
        <button
          className="textbutton"
          key={format}
          onClick={() => runExport(format)}
          disabled={
            busy ||
            exporting ||
            (view === 'saved' ? !visibleSaved.length : !result)
          }
        >
          {format.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <header className="topbar">
        <a className="brand" href="./">
          <BookOpen /> české pády <span>OSOBNÍ SLOVNÍK</span>
        </a>
        {session ? (
          <button
            className="secondary"
            onClick={async () => {
              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) {
                setError('Odhlášení se nezdařilo. Zkuste to znovu.');
              }
            }}
          >
            <LogOut size={16} /> <span>Odhlásit se</span>
          </button>
        ) : (
          <button
            className="secondary"
            onClick={() => setLoginOpen(true)}
            disabled={!authReady}
          >
            <LockKeyhole size={16} /> Přihlásit se
          </button>
        )}
      </header>

      <main className="workspace">
        <div className="eyebrow">SLOVO PO SLOVU</div>
        <h1>Čeština ve všech pádech.</h1>
        <p className="intro">
          Vyhledejte podstatné jméno a uložte si jeho tvary.
        </p>

        <section className="searchbox">
          <label htmlFor="word">Které slovo chcete skloňovat?</label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void check(word).catch(() => {});
            }}
          >
            <Search className="searchicon" />
            <div className="wordcombobox">
              <Combobox
                items={suggestions}
                filter={null}
                inputValue={word}
                onInputValueChange={setWord}
                onValueChange={(value: string | null) => {
                  if (value) setWord(value);
                }}
              >
                <ComboboxInput
                  id="word"
                  aria-label="Slovo ke skloňování"
                  placeholder="Například kamarád, žena nebo město"
                  showTrigger={false}
                  autoComplete="off"
                  maxLength={80}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <button type="submit" disabled={busy || !word.trim()}>
              {busy && <LoaderCircle className="spin" size={18} />}
              {busy ? 'Ověřuji…' : 'Ověřit slovo'} {!busy && '→'}
            </button>
          </form>
          <small>
            Návrhy běžných a uložených slov, i bez diakritiky. Po přihlášení
            také opravy podle příručky.
          </small>
        </section>

        <div className="rodlegend">
          {Object.entries(genders).map(([key, label]) => (
            <span key={key}>
              {label.split(' · ')[0]} <small>{label.split(' · ')[1]}</small>
            </span>
          ))}
        </div>

        <Tabs value={view} onValueChange={(value) => setView(String(value))}>
          <div className="viewbar">
            <TabsList variant="line">
              <TabsTrigger value="lookup">
                <Search size={16} /> Ověření slova
              </TabsTrigger>
              <TabsTrigger value="saved">
                <Bookmark size={16} /> Můj slovník
                <span className="count">{saved.length}</span>
              </TabsTrigger>
            </TabsList>
            {exportButtons}
          </div>

          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice success">
              <Check size={16} /> {message}
            </p>
          )}

          <TabsContent value="lookup">
            <div aria-live="polite" aria-busy={busy}>
              {result ? (
                <section className={`resultcard ${busy ? 'pending' : ''}`}>
                  <div className="resulttop">
                    <div>
                      <div className="eyebrow">
                        {busy ? 'OVĚŘUJI NOVÉ SLOVO…' : 'VÝSLEDEK OVĚŘENÍ'}
                      </div>
                      <h2>{result.word}</h2>
                      <div className="badges">
                        {[
                          ...new Set(
                            result.ijp.entries.map((entry) => entry.gender),
                          ),
                        ].map((entryGender) => (
                          <span
                            className="badge"
                            key={entryGender || 'unknown'}
                          >
                            {entryGender ? genders[entryGender] : 'Rod neurčen'}
                          </span>
                        ))}
                      </div>
                      {result.requested !== result.word && (
                        <p className="correction">
                          Příručka opravila „{result.requested}“ na „
                          {result.word}“.
                        </p>
                      )}
                    </div>
                    <div className="savearea">
                      <button
                        onClick={toggleSaved}
                        disabled={
                          saving ||
                          busy ||
                          !session ||
                          !result.ijp.entries.length
                        }
                        aria-label={
                          currentSaved
                            ? 'Odebrat slovo ze slovníku'
                            : 'Uložit slovo do slovníku'
                        }
                        title={
                          currentSaved
                            ? 'Kliknutím odeberete slovo ze slovníku'
                            : 'Kliknutím uložíte slovo do slovníku'
                        }
                      >
                        {currentSaved ? (
                          <BookmarkCheck size={17} />
                        ) : (
                          <Bookmark size={17} />
                        )}
                        {saving
                          ? 'Ukládám…'
                          : currentSaved
                            ? 'Uloženo'
                            : 'Uložit slovo'}
                      </button>
                      <small>
                        {new Date(result.checkedAt).toLocaleString('cs-CZ')}
                      </small>
                    </div>
                  </div>
                  <DeclensionTable result={result} />
                </section>
              ) : (
                <section className="welcome">
                  <BookOpen size={32} />
                  <h2>Každý pád na svém místě.</h2>
                  <p>Všech 7 pádů v jednotném i množném čísle, vedle sebe.</p>
                  <div className="examples">
                    {['kamarád', 'žena', 'město', 'pes'].map((example) => (
                      <button
                        className="secondary"
                        key={example}
                        onClick={() => {
                          setWord(example);
                          void check(example).catch(() => {});
                        }}
                      >
                        {example} <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                  {!session && (
                    <p className="fineprint">
                      <LockKeyhole size={14} /> Přihlaste se a otevřete svůj
                      soukromý slovník.
                    </p>
                  )}
                  <div className="sources">
                    Internetová jazyková příručka · ÚJČ AV ČR
                  </div>
                </section>
              )}
            </div>
          </TabsContent>

          <TabsContent value="saved">
            <section className="resultcard">
              <div className="savedtop">
                <h2>Můj slovník</h2>
                <button
                  className="secondary refreshbutton"
                  aria-label="Znovu načíst slovník"
                  title="Znovu načíst slovník"
                  onClick={() => refresh()}
                  disabled={!session || savedBusy}
                >
                  <RefreshCw
                    size={22}
                    className={savedBusy ? 'spin' : undefined}
                  />
                </button>
              </div>

              {session ? (
                <>
                  <p className="fineprint">
                    {session.user.email} · Slova jsou přístupná pouze vašemu
                    účtu.
                  </p>
                  <Tabs
                    value={gender}
                    onValueChange={(value) => setGender(String(value))}
                  >
                    <TabsList className="genderfilters">
                      <TabsTrigger value="all">Vše</TabsTrigger>
                      {Object.entries(genders).map(([key, label]) => (
                        <TabsTrigger key={key} value={key}>
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>

                  {savedBusy ? (
                    <p role="status">Načítám slovník…</p>
                  ) : savedError ? (
                    <p role="alert" className="notice error">
                      {savedError}
                    </p>
                  ) : visibleSaved.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Slovo</TableHead>
                          <TableHead>Rod</TableHead>
                          <TableHead>Uloženo</TableHead>
                          <TableHead>Detail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleSaved.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <strong>{row.word}</strong>
                            </TableCell>
                            <TableCell>
                              {[
                                ...new Set(
                                  row.result.ijp.entries.map((entry) =>
                                    entry.gender
                                      ? genders[entry.gender]
                                      : 'Neurčeno',
                                  ),
                                ),
                              ].join(', ')}
                            </TableCell>
                            <TableCell>
                              {new Date(row.updated_at).toLocaleDateString(
                                'cs-CZ',
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                className="textbutton"
                                onClick={() => {
                                  requestId.current += 1;
                                  setBusy(false);
                                  setResult(row.result);
                                  setCurrentSaved(true);
                                  setWord(row.word);
                                  setView('lookup');
                                  setError('');
                                  setMessage('Zobrazen uložený výsledek.');
                                }}
                              >
                                Otevřít →
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="emptysaved">
                      <Bookmark />
                      <h3>
                        {saved.length
                          ? 'V tomto rodu zatím nejsou slova.'
                          : 'Váš slovník čeká na první slovo.'}
                      </h3>
                      <p>Vyhledaná slova se sem ukládají automaticky.</p>
                    </div>
                  )}
                  <p className="fineprint">
                    Export zahrnuje všechna slova z aktuálně vybraného rodu a
                    všech 14 pádových pozic.
                  </p>
                </>
              ) : (
                <div className="emptysaved">
                  <LockKeyhole />
                  <h3>Váš slovník je soukromý.</h3>
                  <button onClick={() => setLoginOpen(true)}>
                    Přihlásit se
                  </button>
                </div>
              )}
            </section>
          </TabsContent>
        </Tabs>

        <footer>
          <span>České pády · Váš prostor pro češtinu</span>
          <a
            href="https://prirucka.ujc.cas.cz/"
            target="_blank"
            rel="noreferrer"
          >
            ÚJČ AV ČR ↗
          </a>
        </footer>
      </main>

      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="loginmodal">
          <DialogHeader>
            <DialogTitle>Přihlášení do slovníku</DialogTitle>
            <DialogDescription>
              Použijte účet ze Supabase Authentication. Váš slovník vidíte pouze
              vy.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={signIn}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">Heslo</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {authError && (
              <p role="alert" className="notice error">
                {authError}
              </p>
            )}
            <button disabled={authBusy}>
              {authBusy ? 'Přihlašuji…' : 'Přihlásit se'}
            </button>
            <p className="fineprint">
              Nemáte účet nebo potřebujete obnovit heslo? Obraťte se na správce
              slovníku.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
