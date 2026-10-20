import AsyncStorage from "@react-native-async-storage/async-storage";
import { openDatabaseAsync } from "expo-sqlite";
import { createSQLiteRepository } from "./sqliteRepository";
import type { BusinessData } from "./business";

export interface BusinessRepository { read(): Promise<BusinessData>; write(data: BusinessData): Promise<void> }
export const localBusinessRepository: BusinessRepository = createSQLiteRepository(
  () => openDatabaseAsync("dokanx.db"),
  () => AsyncStorage.getItem("@dokanx/business/v1"),
);
