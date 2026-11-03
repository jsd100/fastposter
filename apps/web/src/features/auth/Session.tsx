import { drafts } from "../editor/drafts";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, routes, type UserDTO } from "@fastposter/api-client";
import { useNotificationScope } from "@fastposter/ui";
import { navigate } from "../../router";
import { publishSessionEvent, subscribeSessionEvents } from "./sessionSync";
type Session = {
  user: UserDTO | null | undefined;
  setUser: (user: UserDTO | null) => void;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
function NotificationScope() {
  const { user } = useSession();
  useNotificationScope(user ? user.id : "anonymous");
  return null;
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<UserDTO | null>();
  const cache = useQueryClient();
  const latestUser = useRef<UserDTO | null | undefined>(user);
  latestUser.current = user;
  const setUser = (value: UserDTO | null) => {
    cache.clear();
    if (value) drafts.activate(value.id);
    updateUser(value);
    publishSessionEvent(
      value
        ? { type: "login", user: value }
        : { type: "logout", userId: latestUser.current?.id },
    );
  };
  useEffect(() => {
    let active = true;
    let remote = false;
    apiClient
      .request(routes.Me, {})
      .then((r) => {
        if (active && !remote) {
          drafts.activate(r.user.id);
          updateUser(r.user);
        }
      })
      .catch(() => {
        if (active) updateUser(null);
      });
    const sync = subscribeSessionEvents((event) => {
      remote = true;
      cache.clear();
      const previous = latestUser.current?.id;
      if (event.type === "login") {
        if (previous && previous !== event.user.id)
          void drafts.clearUser(previous).catch(() => {});
        drafts.activate(event.user.id);
        updateUser(event.user);
        if (
          previous !== event.user.id &&
          /^\/projects\/[^/]+\/edit$/.test(location.pathname)
        )
          navigate("/projects", true);
      } else {
        if (event.userId)
          void drafts.clearUser(event.userId).catch(() => {});
        updateUser(null);
        navigate("/login", true);
      }
    });
    const expired = () => {
      cache.clear();
      const previous = latestUser.current?.id;
      if (previous) void drafts.clearUser(previous).catch(() => {});
      updateUser(null);
      publishSessionEvent({ type: "logout", userId: previous });
      navigate("/login", true);
    };
    window.addEventListener("session-expired", expired);
    return () => {
      active = false;
      sync();
      window.removeEventListener("session-expired", expired);
    };
  }, [cache]);
  const logout = async () => {
    await apiClient.request(routes.Logout, {});
    const previousUser = user?.id;
    let cleanupError: unknown;
    try {
      if (previousUser) await drafts.clearUser(previousUser);
    } catch (e) {
      cleanupError = e;
    }
    setUser(null);
    window.dispatchEvent(new Event("session-ended"));
    navigate("/login", true);
    if (cleanupError) throw cleanupError;
  };
  return (
    <SessionContext.Provider value={{ user, setUser, logout }}>
      <NotificationScope />
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw Error("SessionProvider missing");
  return value;
}
