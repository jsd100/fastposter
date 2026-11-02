import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Density = "normal" | "compact";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  density?: Density;
};

export function TextInput({
  density = "normal",
  className = "",
  ref,
  ...props
}: TextInputProps) {
  return (
    <input
      {...props}
      ref={ref}
      className={`${styles.text}${density === "compact" ? " " + styles.compact : ""} ${className}`}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({ className = "", ref, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      ref={ref}
      className={`${styles.textarea} ${className}`}
    />
  );
}
