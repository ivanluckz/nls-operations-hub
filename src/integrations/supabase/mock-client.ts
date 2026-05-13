import { getDemoUser, clearDemoSession } from "@/lib/demo-mode";
import { DEMO_TABLE_DATA, DEMO_WEEKLY_SUMMARY } from "@/lib/demo-data";

type Row = Record<string, unknown>;

function getRows(table: string): Row[] {
  return (DEMO_TABLE_DATA[table] as Row[]) ?? [];
}

function matchRow(row: Row, filters: { col: string; op: string; val: unknown }[]): boolean {
  return filters.every(({ col, op, val }) => {
    if (op === "eq")  return row[col] === val;
    if (op === "neq") return row[col] !== val;
    if (op === "in")  return Array.isArray(val) && val.includes(row[col]);
    if (op === "gte") return (row[col] as number) >= (val as number);
    if (op === "lte") return (row[col] as number) <= (val as number);
    return true;
  });
}

class DemoQueryBuilder {
  private _table: string;
  private _filters: { col: string; op: string; val: unknown }[] = [];
  private _isCount = false;
  private _isHead = false;
  private _single = false;
  private _maybeSingle = false;
  private _limit?: number;
  private _order?: { col: string; asc: boolean };

  constructor(table: string) { this._table = table; }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count === "exact") this._isCount = true;
    if (opts?.head)              this._isHead  = true;
    return this;
  }

  eq(col: string, val: unknown)   { this._filters.push({ col, op: "eq",  val }); return this; }
  neq(col: string, val: unknown)  { this._filters.push({ col, op: "neq", val }); return this; }
  in(col: string, val: unknown[]) { this._filters.push({ col, op: "in",  val }); return this; }
  gte(col: string, val: unknown)  { this._filters.push({ col, op: "gte", val }); return this; }
  lte(col: string, val: unknown)  { this._filters.push({ col, op: "lte", val }); return this; }
  not(_col: string, _op: string, _val: unknown) { return this; }
  is(_col: string, _val: unknown) { return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { col, asc: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  single()      { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // Mutations — return success silently
  insert(data: Row | Row[]) {
    return Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null });
  }
  update(_data: Row) {
    const self = this;
    return {
      eq(col: string, val: unknown) { self.eq(col, val); return Promise.resolve({ data: null, error: null }); },
      match(_m: Row)                { return Promise.resolve({ data: null, error: null }); },
    };
  }
  upsert(_data: Row | Row[]) {
    return Promise.resolve({ data: null, error: null });
  }
  delete() {
    return {
      eq: (_col: string, _val: unknown) => Promise.resolve({ data: null, error: null }),
      match: (_m: Row) => Promise.resolve({ data: null, error: null }),
    };
  }

  // Thenable — makes `await supabase.from(...)` work
  then(resolve: (v: unknown) => unknown) {
    return Promise.resolve(this._execute()).then(resolve);
  }

  private _execute() {
    let rows = getRows(this._table).filter((r) => matchRow(r, this._filters));

    if (this._order) {
      const { col, asc } = this._order;
      rows = [...rows].sort((a, b) => {
        if ((a[col] ?? "") < (b[col] ?? "")) return asc ? -1 : 1;
        if ((a[col] ?? "") > (b[col] ?? "")) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this._limit) rows = rows.slice(0, this._limit);

    if (this._isCount && this._isHead) return { data: null, count: rows.length, error: null };
    if (this._isCount)                 return { data: rows, count: rows.length, error: null };
    if (this._single || this._maybeSingle) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }
}

// Fake channel for realtime subscriptions (no-ops)
function fakeChannel(_name: string) {
  const ch = {
    on:        () => ch,
    subscribe: () => ch,
    unsubscribe: () => {},
  };
  return ch;
}

// Build demo auth user from current demo role
function buildDemoAuthUser() {
  const u = getDemoUser();
  return {
    id: u.id,
    email: u.email,
    user_metadata: { full_name: u.name },
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  };
}

function buildDemoSession() {
  const user = buildDemoAuthUser();
  return { user, access_token: "demo-token", refresh_token: "demo-refresh", expires_in: 86400, token_type: "bearer" };
}

// Mock edge-function responses
const FUNCTION_RESPONSES: Record<string, unknown> = {
  "generate-weekly-summary":  DEMO_WEEKLY_SUMMARY,
  "allocate-activities":      { success: true, allocated: 15, message: "Demo: 15 students allocated successfully." },
  "generate-pdf-report":      { url: "#demo-pdf", success: true },
  "generate-allocations-pdf": { url: "#demo-pdf", success: true },
  "send-push":                { success: true },
  "import-students":          { success: true, count: 0 },
  "import-teachers":          { success: true, count: 0 },
  "process-student-request":  { success: true },
  "sync-google-sheets":       { success: true },
  "google-calendar-sync":     { success: true },
  "auto-mark-absent":         { success: true },
  "activity-chatbot":         { reply: "This is a demo — I'm your NLS assistant! In the live app I answer questions about activities, schedules, and more." },
};

// The mock client object — mirrors the Supabase client API
export const mockSupabase = {
  from: (table: string) => new DemoQueryBuilder(table),

  rpc: (name: string, _args?: Record<string, unknown>) => {
    const rpcData: Record<string, unknown> = {
      count_allocated_students: 15,
      has_role: true,
      get_profile_emails: [],
      get_teacher_students: [],
      get_workout_signup_students: [],
      search_users_for_dm: [],
    };
    return Promise.resolve({ data: rpcData[name] ?? null, error: null });
  },

  functions: {
    invoke: (name: string, _opts?: unknown) => {
      return Promise.resolve({ data: FUNCTION_RESPONSES[name] ?? { success: true }, error: null });
    },
  },

  auth: {
    getUser: () => Promise.resolve({ data: { user: buildDemoAuthUser() }, error: null }),
    getSession: () => Promise.resolve({ data: { session: buildDemoSession() }, error: null }),
    signOut: async () => {
      clearDemoSession();
      window.location.href = "/auth";
      return { error: null };
    },
    signInWithPassword: (_creds: unknown) => Promise.resolve({ data: { user: buildDemoAuthUser(), session: buildDemoSession() }, error: null }),
    signInWithOAuth: (_provider: string, _opts: unknown) => Promise.resolve({ data: {}, error: null }),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      setTimeout(() => cb("SIGNED_IN", buildDemoSession()), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    updateUser: (_data: unknown) => Promise.resolve({ data: { user: buildDemoAuthUser() }, error: null }),
    resetPasswordForEmail: (_email: string) => Promise.resolve({ data: {}, error: null }),
  },

  channel:       (name: string) => fakeChannel(name),
  removeChannel: (_ch: unknown) => Promise.resolve(),

  storage: {
    from: (_bucket: string) => ({
      upload:     (_path: string, _file: unknown) => Promise.resolve({ data: { path: "demo/file.jpg" }, error: null }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "https://placehold.co/100x100?text=Demo" } }),
      remove:     (_paths: string[]) => Promise.resolve({ data: [], error: null }),
    }),
  },
};
