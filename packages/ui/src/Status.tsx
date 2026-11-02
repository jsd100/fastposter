import type { ReactNode } from "react";
import styles from "./Status.module.css";

export function Status({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`status status-${tone} ${styles.status}`}
    >
      {children}
    </div>
  );
}
