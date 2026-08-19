import path from "node:path";
import type { ProviderId } from "@/lib/generation/types";
import { tryAppendJsonl } from "./jsonl";
import { userLogsDir } from "./paths";
import type { KeyLifecycleAction } from "./types";

export async function logKeyEvent(
  userId: string,
  provider: ProviderId,
  action: KeyLifecycleAction,
): Promise<void> {
  await tryAppendJsonl(
    "key-event",
    path.join(userLogsDir(userId), "key-events.jsonl"),
    {
      timestamp: new Date().toISOString(),
      userId,
      provider,
      action,
    },
  );
}
