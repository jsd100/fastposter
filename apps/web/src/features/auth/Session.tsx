import { drafts } from "../editor/drafts";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient, routes, type UserDTO } from "@fastposter/api-client";
import { navigate } from "../../router";
type Session = {
  user: UserDTO | null | undefined;
  setUser: (user: UserDTO | null) => void;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<UserDTO | null>();
  const cache = useQueryClient();
  const setUser = (value: UserDTO | null) => {
    cache.clear();
    if (value) drafts.activate(value.id);
    updateUser(value);
  };
  useEffect(() => {
    let active = true;
    apiClient
      .request(routes.Me, {})
      .then((r) => {
        if (active) {
          drafts.activate(r.user.id);
          updateUser(r.user);
        }
      })
      .catch(() => {
        if (active) updateUser(null);
      });
    const expired = () => {
      cache.clear();
      updateUser(null);
      navigate("/login", true);
    };
    window.addEventListener("session-expired", expired);
    return () => {
      active = false;
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
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw Error("SessionProvider missing");
  return value;
}
