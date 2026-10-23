import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseAsync } from "expo-sqlite";
import { createSQLiteRepository } from "./sqliteRepository";
import type { BusinessData } from "./business";
import { createWorkspaceRepositories } from "./workspaces";
import * as Crypto from 'expo-crypto';
import type { SyncOutbox } from '../cloudBackup/outboxTypes';
import type { WriteOptions } from './sqliteRepository';

export interface BusinessRepository { read(): Promise<BusinessData>; write(data: BusinessData,options?:WriteOptions): Promise<void>; outbox?:SyncOutbox; forWorkspace?: (workspace:string)=>BusinessRepository }
export const localBusinessRepository: BusinessRepository = createWorkspaceRepositories((workspace,name)=>createSQLiteRepository(
  () => openDatabaseAsync(name),
  () => workspace==='offline' ? AsyncStorage.getItem("@dokanx/business/v1") : Promise.resolve(null),
  {id:()=>Crypto.randomUUID()},
));
