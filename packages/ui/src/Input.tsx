import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import styles from "./Input.module.css";

type Density = "normal" | "compact";
type Variant = "field" | "bare";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  density?: Density;
  variant?: Variant;
};

export function TextInput({
  density = "normal",
  variant = "field",
  className = "",
  ref,
  ...props
}: TextInputProps) {
  return (
    <input
      {...props}
      data-fp-input=""
      ref={ref}
      className={`${
        variant === "field"
          ? styles.text + (density === "compact" ? " " + styles.compact : "")
          : ""
      } ${className}`}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  variant?: Variant;
};

export function Textarea({
  variant = "field",
  className = "",
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      {...props}
      data-fp-input=""
      ref={ref}
      className={`${variant === "field" ? styles.textarea : ""} ${className}`}
    />
  );
}
