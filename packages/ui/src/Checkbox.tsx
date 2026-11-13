import { Checkbox } from "antd";
import type { ReactElement } from "react";

export type CheckboxFieldProps = {
  /**
   * Read as the control's name. antd puts it in the wrapping `<label>`, so the
   * state is said once and `getByLabel(…)` resolves to the input itself.
   */
  label: string;
  checked: boolean;
  /** Pages keep a boolean; handing them the raw event would repeat the same
   *  `e.target.checked` line at every call site. */
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
  className = "",
}: CheckboxFieldProps): ReactElement {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className={`checkbox-field ${className}`.trim()}
    >
      {label}
    </Checkbox>
  );
}
