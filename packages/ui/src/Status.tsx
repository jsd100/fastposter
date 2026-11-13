import { Alert } from "antd";
import type { ReactNode } from "react";
import styles from "./Status.module.css";

const ROLE = { error: "alert", info: "status", success: "status" } as const;

export function Status({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <Alert
      /* The pages select on `.status-error` and read the live region through
         `role`, so the tone hooks and the announcement stay on the antd alert. */
      type={tone}
      title={<div className={styles.text}>{children}</div>}
      showIcon={false}
      role={ROLE[tone]}
      data-fp-status=""
      className={`status status-${tone}`}
    />
  );
}
