import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { type BusinessData, emptyBusiness, parseBusiness } from "./business";
import { cashTotals } from "./finance";
import { localBusinessRepository, type BusinessRepository } from "./repository";

type Store = { data: BusinessData; ready: boolean; error: boolean; retry: () => void; update: (change: (data: BusinessData) => BusinessData) => Promise<void>; restore: (next: BusinessData, expected: string) => Promise<void> };
const BusinessContext = createContext<Store | null>(null);

export function BusinessProvider({ children, repository = localBusinessRepository }: { children: ReactNode; repository?: BusinessRepository }) {
  const [data, setData] = useState(emptyBusiness);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const latest = useRef(emptyBusiness);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const load = useCallback(() => repository.read().then((saved) => {
      latest.current = saved;
      setData(saved);
      setReady(true);
    }).catch(() => {
      setError(true);
    }), [repository]);
  useEffect(() => { void load(); }, [load]);
  const update = useCallback((change: (value: BusinessData) => BusinessData) => {
    const operation = queue.current.then(async () => {
      if (!ready) throw new Error("storageUnavailable");
      const next = change(latest.current);
      for (const day of latest.current.cashDays ?? []) if (day.closedAt && cashTotals(next, day.day).expected !== cashTotals(latest.current, day.day).expected) throw new Error("cashDayClosed");
      await repository.write(next);
      latest.current = next;
      setData(next);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ready, repository]);
  const restore = useCallback(async (next: BusinessData, expected: string) => {
    const operation = queue.current.then(async () => {
      if (!ready || JSON.stringify(latest.current) !== expected) throw new Error("restoreStale");
      const validated = parseBusiness(JSON.stringify(next));
      await repository.write(validated);
      latest.current = validated; setData(validated);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ready, repository]);
  return <BusinessContext.Provider value={{ data, ready, error, retry: () => { setReady(false); setError(false); void load(); }, update, restore }}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const store = useContext(BusinessContext);
  if (!store) throw new Error("BusinessProvider is required");
  return store;
}
