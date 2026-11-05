import { Input as AntInput } from "antd";
import type { InputRef } from "antd";
import type {
  ComponentRef,
  InputHTMLAttributes,
  Ref,
  TextareaHTMLAttributes,
} from "react";

type Density = "normal" | "compact";
type Variant = "field" | "bare";
/** antd exports `InputRef` but not the textarea instance type. */
type TextAreaInstance = ComponentRef<typeof AntInput.TextArea>;

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
  density?: Density;
  variant?: Variant;
  status?: "error" | "warning";
};

/** antd hands back its own ref object; callers keep the native element. */
function nativeInput(
  ref: Ref<HTMLInputElement> | undefined,
): (instance: InputRef | null) => void {
  return (instance) => {
    const node = instance?.input ?? null;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
}

function nativeTextarea(
  ref: Ref<HTMLTextAreaElement> | undefined,
): (instance: TextAreaInstance | null) => void {
  return (instance) => {
    // A plain antd TextArea renders the `<textarea>` itself as its native
    // element; the wrapper only appears with counters or clear buttons.
    const node = (instance?.nativeElement ??
      null) as HTMLTextAreaElement | null;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
}

export function TextInput({
  density = "normal",
  variant = "field",
  className = "",
  ref,
  ...props
}: TextInputProps) {
  return (
    <AntInput
      {...props}
      ref={nativeInput(ref)}
      data-fp-input=""
      variant={variant === "bare" ? "borderless" : "outlined"}
      size={density === "compact" ? "small" : undefined}
      className={`${variant === "field" ? "fp-field " : ""}${className}`}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: Ref<HTMLTextAreaElement>;
  variant?: Variant;
  status?: "error" | "warning";
};

export function Textarea({
  variant = "field",
  className = "",
  ref,
  ...props
}: TextareaProps) {
  return (
    <AntInput.TextArea
      {...props}
      ref={nativeTextarea(ref)}
      data-fp-input=""
      variant={variant === "bare" ? "borderless" : "outlined"}
      className={`${variant === "field" ? "fp-field " : ""}fp-textarea ${className}`}
    />
  );
}
