import type { UserDTO } from "@fastposter/api-client";

const KEY = "fastposter-session-event";

export type SessionEvent =
  | { type: "login"; user: UserDTO }
  | { type: "logout"; userId?: string };

export function publishSessionEvent(event: SessionEvent) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...event,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    );
  } catch {
    // Private browsing may disable storage; local state still updates.
  }
}

export function subscribeSessionEvents(handler: (event: SessionEvent) => void) {
  const listener = (event: StorageEvent) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      const value = JSON.parse(event.newValue);
      if (value?.type === "login" && typeof value.user?.id === "string")
        handler({ type: "login", user: value.user as UserDTO });
      else if (value?.type === "logout")
        handler({
          type: "logout",
          userId:
            typeof value.userId === "string" ? value.userId : undefined,
        });
    } catch {
      // Ignore malformed events from other versions of the app.
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
