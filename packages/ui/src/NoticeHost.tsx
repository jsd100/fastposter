import { App } from "antd";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  createNoticeStore,
  type Notice,
  type NoticeEntry,
  type NoticeStore,
} from "./notifications";
import styles from "./NoticeHost.module.css";

const NotificationsContext = createContext<NoticeStore | null>(null);

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const { message } = App.useApp();
  const store = useMemo(() => {
    let storeRef: NoticeStore;
    const created = createNoticeStore({
      upsert(entry) {
        message.open({
          key: entry.id,
          content: (
            <NoticeCard
              entry={entry}
              onDismiss={() => storeRef.close(entry.id)}
            />
          ),
          duration: entry.timeout / 1000,
          icon: null,
          styles: {
            root: {
              padding: 0,
              background: "transparent",
              boxShadow: "none",
            },
          },
        });
      },
      dismiss(id) {
        message.destroy(id);
      },
    });
    storeRef = created;
    return created;
  }, [message]);
  return (
    <NotificationsContext.Provider value={store}>
      {children}
    </NotificationsContext.Provider>
  );
}

function NoticeCard({
  entry,
  onDismiss,
}: {
  entry: NoticeEntry;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`${styles.toast} ${styles[entry.tone]}`}
      data-testid="notice"
    >
      <div className={styles.copy}>
        <div className={styles.title}>{entry.title}</div>
        {entry.description ? (
          <div className={styles.description}>{entry.description}</div>
        ) : null}
      </div>
      {entry.action ? (
        <button
          type="button"
          className={styles.action}
          data-testid="notice-action"
          onClick={() => entry.action?.onClick()}
        >
          {entry.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.close}
        aria-label="关闭通知"
        data-testid="notice-close"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

function useNoticeStore() {
  const store = useContext(NotificationsContext);
  if (!store) throw Error("NotificationsProvider missing");
  return store;
}

export function useNotify() {
  const store = useNoticeStore();
  const generation = useSyncExternalStore(
    store.subscribe,
    () => store.generation,
    () => store.generation,
  );
  const show = useCallback(
    (notice: Notice) => store.show(notice, generation),
    [store, generation],
  );
  const close = useCallback((id: string) => store.close(id), [store]);
  return useMemo(() => ({ show, close }), [show, close]);
}

export function useNotificationScope(scopeKey: string) {
  const store = useNoticeStore();
  useEffect(() => {
    store.setScope(scopeKey);
  }, [store, scopeKey]);
}

export function useErrorNotice(
  id: string,
  error: string | null,
  options?: { persistent?: boolean; action?: Notice["action"] },
) {
  const { show, close } = useNotify();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef(id);
  idRef.current = id;
  useEffect(() => () => closeRef.current(idRef.current), []);
  useEffect(() => {
    if (!error) {
      close(id);
      return;
    }
    const action = optionsRef.current?.action;
    show({
      id,
      tone: "error",
      title: error,
      persistent: optionsRef.current?.persistent,
      action: action
        ? {
            label: action.label,
            onClick: () => optionsRef.current?.action?.onClick(),
          }
        : undefined,
    });
  }, [id, error, show, close]);
}
