export type CloudSession = { user: { id: string; phone: string }; sessionId: string; accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string; needsSync?:boolean; binding?: { id: string; localShopId: string; name: string } };
export type OtpChallenge = { challengeId: string; phone: string; expiresAt: string; retryAfterSeconds: number; delivery: string; developmentCode?: string };
export type AccountRequest = { body?: unknown; fileUri?: string; saveTo?: string; headers?: Record<string, string>; expectedBytes?:number; onProgress?:(received:number,total:number)=>void };
type Api = { request: (path: string, options?: AccountRequest & { token?: string }) => Promise<unknown> };
export type AccountState = { ready: boolean; busy: boolean; session: CloudSession | null; storageError: boolean };
const text = (s: unknown): s is string => typeof s === "string" && !!s.trim();
const token = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
export function validSession(value: unknown): value is CloudSession {
  const s = value as CloudSession;
  return !!s && !!s.user && text(s.user.id) && text(s.user.phone) && text(s.sessionId) && token(s.accessToken) && token(s.refreshToken) && text(s.accessExpiresAt) && Number.isFinite(Date.parse(s.accessExpiresAt)) && text(s.refreshExpiresAt) && Number.isFinite(Date.parse(s.refreshExpiresAt)) && (s.needsSync===undefined || typeof s.needsSync==='boolean') && (s.binding === undefined || !!s.binding && text(s.binding.id) && text(s.binding.localShopId) && text(s.binding.name));
}
export function createAccountController(deps: { api: Api; read: () => Promise<string | null>; write: (value: string | null) => Promise<void>; device: () => Promise<string>; deviceName: string; now?: () => number }) {
  let state: AccountState = { ready: false, busy: false, session: null, storageError: false };
  let loading: Promise<void> | undefined;
  const listeners = new Set<() => void>(), now = deps.now ?? Date.now;
  const set = (patch: Partial<AccountState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  const persist = async (session: CloudSession | null) => {
    try { await deps.write(session ? JSON.stringify(session) : null); set({ session, storageError: false }); }
    catch { set({ session: null, storageError: true }); throw new Error("accountStorage"); }
  };
  const run = async <T>(operation: () => Promise<T>) => {
    if (!state.ready || state.busy) throw new Error("accountBusy");
    set({ busy: true }); try { return await operation(); } finally { set({ busy: false }); }
  };
  const authorized = async (path: string, body?: unknown, options: AccountRequest = {}) => {
    let session = state.session;
    if (!session) throw new Error("unauthorized");
    if (Date.parse(session.accessExpiresAt) <= now() + 30000) {
      try {
        const next = await deps.api.request("/auth/refresh", { body: { refreshToken: session.refreshToken } });
        if (!validSession(next) || next.user.id !== session.user.id || next.sessionId !== session.sessionId) throw new Error("invalidResponse");
        session = { ...next, ...(session.binding ? { binding: session.binding } : {}), ...(session.needsSync!==undefined?{needsSync:session.needsSync}:{}) };
        await persist(session);
      } catch (error) { if (error instanceof Error && error.message === "unauthorized") await persist(null); throw error; }
    }
    try { return await deps.api.request(path, { ...options, token: session.accessToken, ...(body !== undefined ? { body } : {}) }); }
    catch (error) { if (error instanceof Error && error.message === "unauthorized") await persist(null); throw error; }
  };
  return {
    beginSync() {return run(async()=>{if(!state.session)throw new Error('unauthorized');await persist({...state.session,needsSync:true});});},
    completeSync(shopId:string) {return run(async()=>{
      const response=await authorized('/auth/shops') as {shops:NonNullable<CloudSession['binding']>[]};
      const binding=response?.shops?.find(shop=>shop.id===shopId);
      if(!state.session || !binding || !text(binding.localShopId) || !text(binding.name))throw new Error('invalidResponse');
      await persist({...state.session,binding,needsSync:false});
    });},
    cloudRequest(path: string, options: AccountRequest = {}) { return run(() => authorized(path, options.body, options)); },
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load() {
      loading ??= (async () => {
        try {
          const raw = await deps.read();
          if (raw) { const value: unknown = JSON.parse(raw); if (!validSession(value)) throw new Error("accountStorage"); set({ session: value }); }
          set({ ready: true });
        } catch { set({ ready: true, storageError: true }); }
      })();
      return loading;
    },
    requestCode(phone: string, intent: "login" | "signup" = "login") { return run(async () => {
      const result = await deps.api.request("/auth/otp/start", { body: { phone, intent } }) as OtpChallenge;
      if (!result || !text(result.challengeId) || !text(result.phone) || !text(result.expiresAt) || !Number.isFinite(Date.parse(result.expiresAt)) || !Number.isSafeInteger(result.retryAfterSeconds) || result.retryAfterSeconds < 0) throw new Error("invalidResponse");
      return result;
    }); },
    verify(challengeId: string, code: string, intent?: "login" | "signup") { return run(async () => {
      const result = await deps.api.request("/auth/otp/verify", { body: { challengeId, code, deviceId: await deps.device(), deviceName: deps.deviceName, ...(intent ? { intent } : {}) } });
      if (!validSession(result)) throw new Error("invalidResponse");
      await persist({...result,needsSync:true});
    }); },
    refreshProfile() { return run(async () => {
      const result = await authorized("/auth/me") as CloudSession["user"];
      if (!state.session || result?.id !== state.session.user.id || !text(result.phone)) throw new Error("invalidResponse");
      await persist({ ...state.session, user: result });
    }); },
    linkShop(localShopId: string, name: string) { return run(async () => {
      const binding = await authorized("/auth/shops", { localShopId, name }) as NonNullable<CloudSession["binding"]>;
      if (!state.session || !binding || !text(binding.id) || binding.localShopId !== localShopId || !text(binding.name)) throw new Error("invalidResponse");
      await persist({ ...state.session, binding });
    }); },
    logout() { return run(async () => {
      let revoked = false;
      try { if (state.session) { await authorized("/auth/logout", {}); revoked = true; } }
      catch { /* Local sign-out remains available with no network. Other data is never touched. */ }
      await persist(null);
      return { revoked };
    }); },
  };
}
