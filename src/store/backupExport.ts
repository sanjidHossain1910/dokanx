import { Directory, File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { BACKUP_LIMIT } from "./backupFormat";

function sourceFile(uri: string) {
  const file = new File(uri);
  if (!file.exists) throw new Error("backupFileMissing");
  if (!file.size || file.size > BACKUP_LIMIT) throw new Error("invalidBackup");
  return file;
}

export async function shareBackup(uri: string) {
  sourceFile(uri);
  if (!await Sharing.isAvailableAsync()) throw new Error("backupShareUnavailable");
  await Sharing.shareAsync(uri, { mimeType: "application/octet-stream", UTI: "public.data", dialogTitle: "DokanX backup" });
}

/** Android's share sheet is not a file-save dialog. Export through its folder picker. */
export async function saveBackup(uri: string): Promise<{ name: string } | undefined> {
  const source = sourceFile(uri);
  if (Platform.OS !== "android") {
    // iOS provides Save to Files inside the system share sheet; dismissal is not proof of saving.
    await shareBackup(uri);
    return;
  }
  let folder: Directory;
  try { folder = await Directory.pickDirectoryAsync(); }
  catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ERR_PICKER_CANCELLED" || code === "ERR_FILE_PICKING_CANCELLED" ||
      error instanceof Error && /file picker was cancel[l]?ed by the user/i.test(error.message)) return;
    throw new Error("backupSaveFailed");
  }
  let target: File | undefined;
  try {
    const bytes = await source.bytes();
    if (!bytes.length || bytes.length > BACKUP_LIMIT) throw new Error("invalidBackup");
    target = folder.createFile(source.name, "application/x-dokanx");
    // The selected folder can be a content:// document provider. Write to its created document.
    target.write(bytes);
    if (!target.exists || target.size !== bytes.length) throw new Error("backupSaveFailed");
    const saved = await target.bytes();
    if (saved.length !== bytes.length || saved.some((byte, index) => byte !== bytes[index])) throw new Error("backupSaveFailed");
    return { name: target.name };
  } catch {
    // Only the new, incomplete export is removed. The original private backup is retained.
    try { if (target?.exists) target.delete(); } catch {}
    throw new Error("backupSaveFailed");
  }
}
