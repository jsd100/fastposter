export type ShortcutContext = {
  defaultPrevented: boolean;
  isComposing: boolean;
  editableTarget: boolean;
  interactiveTarget: boolean;
  overlayOpen: boolean;
};

export function isEditorShortcutBlocked(context: ShortcutContext): boolean {
  return (
    context.defaultPrevented ||
    context.isComposing ||
    context.editableTarget ||
    context.interactiveTarget ||
    context.overlayOpen
  );
}

const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable="true"]';

function isOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector("[data-fp-popup]")) return true;
  for (const overlay of document.querySelectorAll("[data-fp-overlay]")) {
    if (overlay instanceof HTMLDialogElement ? overlay.open : true) return true;
  }
  return false;
}

export function shouldIgnoreEditorShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return isEditorShortcutBlocked({
    defaultPrevented: event.defaultPrevented,
    isComposing: event.isComposing || event.keyCode === 229,
    editableTarget: !!target?.closest?.(EDITABLE_SELECTOR),
    interactiveTarget: !!target?.closest?.("[data-fp-control]"),
    overlayOpen: isOverlayOpen(),
  });
}
