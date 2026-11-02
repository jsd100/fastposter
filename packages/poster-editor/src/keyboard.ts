export type ShortcutContext = {
  defaultPrevented: boolean;
  isComposing: boolean;
  editableTarget: boolean;
  pickerTarget: boolean;
  overlayOpen: boolean;
};

export function isEditorShortcutBlocked(context: ShortcutContext): boolean {
  return (
    context.defaultPrevented ||
    context.isComposing ||
    context.editableTarget ||
    context.pickerTarget ||
    context.overlayOpen
  );
}

const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable="true"]';
// A native menulist swallowed these keys while it had focus; its replacement is
// the combobox trigger. A plain button never did, so it must not either.
const PICKER_SELECTOR = '[role="combobox"]';

function isOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-fp-popup]")) return true;
  return document.querySelector("[data-fp-overlay]") !== null;
}

export function shouldIgnoreEditorShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return isEditorShortcutBlocked({
    defaultPrevented: event.defaultPrevented,
    isComposing: event.isComposing || event.keyCode === 229,
    editableTarget: !!target?.closest?.(EDITABLE_SELECTOR),
    pickerTarget: !!target?.closest?.(PICKER_SELECTOR),
    overlayOpen: isOverlayOpen(),
  });
}
