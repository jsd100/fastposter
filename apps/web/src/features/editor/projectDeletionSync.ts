export const PROJECT_DELETION_KEY = "fastposter-project-deletion";

export type ProjectDeletionEvent = {
  userId: string;
  projectId: string;
};

function parseEvent(value: unknown): ProjectDeletionEvent | undefined {
  if (!value || typeof value !== "object") return;
  const event = value as Record<string, unknown>;
  if (typeof event.userId !== "string" || typeof event.projectId !== "string")
    return;
  return { userId: event.userId, projectId: event.projectId };
}

export function publishProjectDeletion(event: ProjectDeletionEvent) {
  try {
    window.localStorage.setItem(
      PROJECT_DELETION_KEY,
      JSON.stringify({
        ...event,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    );
  } catch {
    // Private browsing may disable storage; same-tab editors still stop below.
  }
  window.dispatchEvent(
    new CustomEvent(PROJECT_DELETION_KEY, { detail: event }),
  );
}

export function subscribeProjectDeletions(
  handler: (event: ProjectDeletionEvent) => void,
) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROJECT_DELETION_KEY || !event.newValue) return;
    try {
      const parsed = parseEvent(JSON.parse(event.newValue));
      if (parsed) handler(parsed);
    } catch {
      // Ignore malformed events from other versions of the app.
    }
  };
  const onLocal = (event: Event) => {
    const parsed = parseEvent((event as CustomEvent).detail);
    if (parsed) handler(parsed);
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(PROJECT_DELETION_KEY, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROJECT_DELETION_KEY, onLocal);
  };
}

export function matchesProjectDeletion(
  event: ProjectDeletionEvent,
  userId: string,
  projectId: string,
) {
  return event.userId === userId && event.projectId === projectId;
}
