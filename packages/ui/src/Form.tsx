import { useId, type InputHTMLAttributes, type ReactNode } from "react";
export function FormField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-describedby={hint ? id + "-hint" : undefined}
      />
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
