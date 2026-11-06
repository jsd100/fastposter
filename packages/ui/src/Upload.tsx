import { Upload } from "antd";
import type { UploadFile } from "antd";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./Button";

export type FileFieldProps = {
  /**
   * Lands on the hidden `input[type=file]`, which is what a screen reader and
   * a test both need to target — the visible button only opens the picker.
   */
  "aria-label": string;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  accept?: string;
  disabled?: boolean;
  /** The trigger sits in a dense row on some pages and in a form on others. */
  density?: "normal" | "compact";
  /** The chosen file, or null. Uploading is not this control's job. */
  value: File | null;
  onChange: (file: File | null) => void;
  className?: string;
};

/**
 * Picking, cancelling and submitting are three separate moments:
 *
 * - the OS picker is dismissed → `onChange` never fires, nothing is sent;
 * - a file is chosen → `onChange(file)` and `beforeUpload` returns false, so
 *   antd does not start its own request;
 * - the page submits → it calls `apiClient.upload` with its own FormData and
 *   gets its own error handling, which is what the rest of the app already does.
 *
 * Clearing the pending file (its remove control) is the cancel-after-picking
 * case and reports `null`.
 *
 * antd's own `onChange` is deliberately absent: its guidance is for callers who
 * append to a list they keep, and here the list is derived from `value`, so the
 * single item is always exactly what the page holds. Adding the handler would
 * only let a selection reach the page twice.
 */
export function FileField({
  "aria-label": ariaLabel,
  label,
  icon,
  hint,
  accept,
  disabled,
  density = "normal",
  value,
  onChange,
  className = "",
}: FileFieldProps): ReactElement {
  const pending: UploadFile[] = value
    ? [{ uid: "fp-pending", name: value.name, status: "done" }]
    : [];
  return (
    <div className={`file-field ${className}`.trim()}>
      <Upload
        aria-label={ariaLabel}
        accept={accept}
        disabled={disabled}
        fileList={pending}
        showUploadList={{ showPreviewIcon: false }}
        beforeUpload={(file) => {
          onChange(file);
          // Returning false is what keeps a selection from becoming an upload.
          return false;
        }}
        onRemove={() => onChange(null)}
      >
        <Button disabled={disabled} density={density}>
          {icon}
          {label}
        </Button>
      </Upload>
      {hint && <small className="file-field-hint">{hint}</small>}
    </div>
  );
}
