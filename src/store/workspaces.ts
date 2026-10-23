import type { BusinessData } from "./business.ts";
import type { SyncOutbox } from '../cloudBackup/outboxTypes.ts';
import type { WriteOptions } from './sqliteRepository.ts';
export type WorkspaceRepository = {
  read(): Promise<BusinessData>;
  write(data: BusinessData,options?:WriteOptions): Promise<void>;
  outbox?:SyncOutbox;
};
export function workspaceDatabaseName(workspace: string) {
  if (workspace === "offline") return "dokanx.db";
  if (!/^account:[A-Za-z0-9-]{1,80}$/.test(workspace))
    throw new Error("invalidWorkspace");
  return `dokanx-account-${workspace.slice(8)}.db`;
}
export function createWorkspaceRepositories(
  factory: (workspace: string, name: string) => WorkspaceRepository,
) {
  const repositories = new Map<string, WorkspaceRepository>();
  const forWorkspace = (workspace: string) => {
    const name = workspaceDatabaseName(workspace);
    let repository = repositories.get(workspace);
    if (!repository) {
      repository = factory(workspace, name);
      repositories.set(workspace, repository);
    }
    return repository;
  };
  const offline = forWorkspace("offline");
  return { ...offline, forWorkspace };
}
