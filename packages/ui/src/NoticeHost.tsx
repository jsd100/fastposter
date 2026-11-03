import { Toast } from "@base-ui/react/toast";
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
  type NoticeStore,
} from "./notifications";
import { subscribeModalLayers, topModalLayer } from "./modal-layer";
import styles from "./NoticeHost.module.css";

const NotificationsContext = createContext<NoticeStore | null>(null);

export function NotificationsProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const manager = useMemo(() => Toast.createToastManager(), []);
  const store = useMemo(
    () =>
      createNoticeStore({
        upsert(entry) {
          manager.add({
            id: entry.id,
            title: entry.title,
            description: entry.description,
            type: entry.tone,
            timeout: entry.timeout,
            actionProps: entry.action
              ? {
                  children: entry.action.label,
                  onClick: entry.action.onClick,
                }
              : undefined,
            data: { generation: entry.generation },
          });
        },
        dismiss(id) {
          manager.close(id);
        },
      }),
    [manager],
  );
  const container = useSyncExternalStore(
    subscribeModalLayers,
    topModalLayer,
    () => null,
  );
  return (
    <NotificationsContext.Provider value={store}>
      <Toast.Provider toastManager={manager} limit={3} timeout={4000}>
        {children}
        <Toast.Portal container={container ?? undefined}>
          <ToastList />
        </Toast.Portal>
      </Toast.Provider>
    </NotificationsContext.Provider>
  );
}

function ToastList() {
  const { toasts, close } = Toast.useToastManager();
  return (
    <Toast.Viewport aria-label="通知" className={styles.viewport}>
      {toasts.map((toast) => (
        <Toast.Root
          key={toast.id}
          toast={toast}
          className={`${styles.toast} ${styles[toast.type ?? "info"]}`}
          data-testid="notice"
        >
          <div className={styles.copy}>
            <Toast.Title className={styles.title}>{toast.title}</Toast.Title>
            {toast.description ? (
              <Toast.Description className={styles.description}>
                {toast.description}
              </Toast.Description>
            ) : null}
          </div>
          {toast.actionProps ? (
            <Toast.Action className={styles.action} data-testid="notice-action" />
          ) : null}
          <button
            type="button"
            className={styles.close}
            aria-label="关闭通知"
            data-testid="notice-close"
            onClick={() => close(toast.id)}
          >
            ×
          </button>
        </Toast.Root>
      ))}
    </Toast.Viewport>
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
