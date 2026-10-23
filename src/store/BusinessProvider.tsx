import type { ConflictResolution } from "../cloudBackup/outboxTypes";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { type BusinessData, emptyBusiness, parseBusiness } from "./business";
import { cashTotals } from "./finance";
import { localBusinessRepository, type BusinessRepository } from "./repository";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cloudGenerationKey } from '../cloudBackup/keys';

type Store = { resolveConflict:(input:ConflictResolution)=>Promise<void>; syncOutbox:()=>BusinessRepository["outbox"]; data: BusinessData; workspace:string; selectWorkspace:(workspace:string)=>Promise<void>; readOffline:()=>Promise<BusinessData>; restoreEpoch: number; ready: boolean; error: boolean; retry: () => void; update: (change: (data: BusinessData) => BusinessData) => Promise<void>; applySync: (next: BusinessData, expected: string) => Promise<void>; restore: (next: BusinessData, expected: string) => Promise<void> };
const BusinessContext = createContext<Store | null>(null);

export function BusinessProvider({ children, repository = localBusinessRepository }: { children: ReactNode; repository?: BusinessRepository }) {
  const [data, setData] = useState(emptyBusiness);
  const [restoreEpoch, setRestoreEpoch] = useState(0);
  const epochRef=useRef(0);
  const [workspace,setWorkspace]=useState('offline');
  const workspaceRef=useRef('offline'), selectedRepository=useRef(repository);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const latest = useRef(emptyBusiness);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const load = useCallback(() => {
    const operation=queue.current.then(()=>selectedRepository.current.read()).then((saved) => {
      latest.current = saved;
      setData(saved);
      setReady(true);
    });
    queue.current=operation.catch(()=>{});
    return operation.catch(() => {
      setError(true);
    });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selectWorkspace=useCallback((nextWorkspace:string)=>{
    const operation=queue.current.then(async()=>{
      if(workspaceRef.current===nextWorkspace)return;
      const target=repository.forWorkspace?.(nextWorkspace);
      if(!target)throw new Error('invalidWorkspace');
      const saved=await target.read();
      selectedRepository.current=target;workspaceRef.current=nextWorkspace;latest.current=saved;
      epochRef.current++;setWorkspace(nextWorkspace);setData(saved);setReady(true);setError(false);setRestoreEpoch(epochRef.current);
    });queue.current=operation.catch(()=>{});return operation;
  },[repository]);
  const readOffline=useCallback(()=>repository.read(),[repository]);
  const update = useCallback((change: (value: BusinessData) => BusinessData) => {
    const expectedWorkspace=workspace;
    const expectedEpoch=restoreEpoch;
    const operation = queue.current.then(async () => {
      if (!ready) throw new Error("storageUnavailable");
      if(workspaceRef.current!==expectedWorkspace || epochRef.current!==expectedEpoch)throw new Error('workspaceChanged');
      const next = change(latest.current);
      for (const day of latest.current.cashDays ?? []) if (day.closedAt && cashTotals(next, day.day).expected !== cashTotals(latest.current, day.day).expected) throw new Error("cashDayClosed");
      await selectedRepository.current.write(next);
      latest.current = next;
      setData(next);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ready, workspace, restoreEpoch]);
  const restore = useCallback(async (next: BusinessData, expected: string) => {
    const expectedWorkspace=workspace;
    const expectedEpoch=restoreEpoch;
    const operation = queue.current.then(async () => {
      if (!ready || workspaceRef.current!==expectedWorkspace || epochRef.current!==expectedEpoch || JSON.stringify(latest.current) !== expected) throw new Error("restoreStale");
      const validated = parseBusiness(JSON.stringify(next));
      // Restored history must not silently become a new automatic cloud head.
      await AsyncStorage.setItem(cloudGenerationKey(expectedWorkspace), `${Date.now()}-${Math.random()}`);
      await selectedRepository.current.write(validated,{origin:"restore"});
      epochRef.current++;latest.current = validated; setData(validated); setRestoreEpoch(epochRef.current);
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [ready, workspace, restoreEpoch]);
  const applySync = useCallback(async (next: BusinessData, expected: string) => {
    const expectedWorkspace=workspace, expectedEpoch=restoreEpoch;
    const operation=queue.current.then(async()=>{
      if(!ready || workspaceRef.current!==expectedWorkspace || epochRef.current!==expectedEpoch || JSON.stringify(latest.current)!==expected)throw new Error('restoreStale');
      const validated=parseBusiness(JSON.stringify({...next,saleDraft:latest.current.saleDraft,purchaseDraft:latest.current.purchaseDraft,notificationReadSignature:latest.current.notificationReadSignature,heldSales:latest.current.heldSales}));
      if(validated.shopId!==latest.current.shopId)throw new Error('syncConflict');
      await selectedRepository.current.write(validated,{origin:"remote"});latest.current=validated;setData(validated);
    });queue.current=operation.catch(()=>{});return operation;
  },[ready,workspace,restoreEpoch]);
  const resolveConflict = useCallback(async (input: ConflictResolution) => {
    const expectedWorkspace = workspace, expectedEpoch = restoreEpoch;
    const operation = queue.current.then(async () => {
      if (!ready || workspaceRef.current !== expectedWorkspace || epochRef.current !== expectedEpoch || JSON.stringify(latest.current) !== input.expected) throw new Error('conflictReviewStale');
      const outbox = selectedRepository.current.outbox;
      if (!outbox?.resolve) throw new Error('queueUnavailable');
      await outbox.resolve(input);
      latest.current = input.data; setData(input.data);
    });
    queue.current = operation.catch(() => {}); return operation;
  }, [ready, workspace, restoreEpoch]);
  const syncOutbox=useCallback(()=>{
    if(workspaceRef.current!==workspace || epochRef.current!==restoreEpoch)throw new Error('backupContextChanged');
    return selectedRepository.current.outbox;
  },[workspace,restoreEpoch]);
  return <BusinessContext.Provider value={{ data, resolveConflict, syncOutbox, workspace, selectWorkspace, readOffline, restoreEpoch, ready, error, applySync, retry: () => { setReady(false); setError(false); void load(); }, update, restore }}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const store = useContext(BusinessContext);
  if (!store) throw new Error("BusinessProvider is required");
  return store;
}
