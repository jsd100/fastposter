import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { TextInput } from "./Input";
import styles from "./Form.module.css";

export type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  ref?: Ref<HTMLInputElement>;
};

export function FormField({
  label,
  hint,
  error,
  id,
  className = "",
  ref,
  ...props
}: FormFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");
  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      <TextInput
        {...props}
        ref={ref}
        id={fieldId}
        className={`${error ? styles.invalid + " " : ""}${className}`}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
      />
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className={styles.error}>
          {error}
        </small>
      )}
    </div>
  );
}
