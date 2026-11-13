import { useEffect, useMemo, useRef } from "react";
import { ApiClientError } from "@fastposter/api-client";
import type { AssetDTO, CreateProjectInput } from "@fastposter/api-client";

/** FP-05: the minimal asset shape a fresh poster is built from. */
export type ProjectBackground = Pick<
  AssetDTO,
  "id" | "version" | "width" | "height"
>;

export const TITLE_MAX_CODE_POINTS = 120;
export const UNTITLED_TITLE = "未命名海报";

/** Unicode Cc control characters (C0, DEL, C1), matching unicode.IsControl. */
function isControl(codePoint: number): boolean {
  return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
}

/**
 * FP-05 / Ruling 51. Derive a title from a file name that the server will
 * accept: drop a trailing extension, strip control characters, cap at 120
 * Unicode code points (Array.from, not UTF-16 units), and fall back when the
 * result is empty. The server validateTitle() has these exact constraints.
 */
export function normalizeTitle(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const points = Array.from(withoutExtension).filter(
    (ch) => !isControl(ch.codePointAt(0)!),
  );
  const cleaned = points.slice(0, TITLE_MAX_CODE_POINTS).join("").trim();
  return cleaned || UNTITLED_TITLE;
}

/**
 * FP-05 / Ruling 51. Build the CreateProjectInput for a poster whose
 * background is an already uploaded asset. The canvas keeps the asset's
 * original dimensions. Shared by the local two-step chain and (A06) the
 * background library; templates keep their own ApplyTemplate/ImportTemplate
 * routes.
 */
export function buildProjectFromBackground(
  title: string,
  asset: ProjectBackground,
): CreateProjectInput {
  const document = {
    schemaVersion: 1,
    canvas: { width: asset.width, height: asset.height },
    background: { assetId: asset.id, version: asset.version },
    fonts: [],
    textBlocks: [],
  };
  return { title, document: JSON.stringify(document) };
}

export type CreationFailure =
  "auth-required" | "known-rejection" | "unknown-outcome";

/**
 * FP-06 / Ruling 48. A well-formed 4xx reply with a business code is a known,
 * uncommitted rejection and may be retried within the same operation. 5xx,
 * INVALID_RESPONSE (non-JSON), network TypeError, timeout and abort leave the
 * outcome unconfirmed and must never be resubmitted automatically.
 * AUTH_REQUIRED stays on the existing session-expired path.
 */
export function classifyCreationFailure(error: unknown): CreationFailure {
  if (error instanceof ApiClientError) {
    if (error.code === "AUTH_REQUIRED") return "auth-required";
    if (error.code === "INVALID_RESPONSE") return "unknown-outcome";
    if (error.status >= 500) return "unknown-outcome";
    if (error.status >= 400) return "known-rejection";
  }
  return "unknown-outcome";
}

export type CreationOperation = { userId: string; token: number };

/**
 * FP-06 / Ruling 50. Gate every create reply on the account that owns it, an
 * operation id, and the lifetime of the page that started it. claim() is a
 * synchronous submit lock: consecutive operations leave exactly one in-flight
 * write. After logout, account switch or leaving the flow, isValid() is false
 * and a late reply must not navigate, show a stale notice or refresh the new
 * account's list.
 */
export function useCreationScope(userId: string) {
  const state = useRef({ userId, token: 0, live: true, inFlight: false });
  // Always reflect the account that currently owns this page.
  state.current.userId = userId;
  useEffect(() => {
    state.current.live = true;
    return () => {
      state.current.live = false;
    };
  }, []);
  return useMemo(
    () => ({
      claim(): CreationOperation | null {
        if (!state.current.live || state.current.inFlight) return null;
        state.current.inFlight = true;
        state.current.token += 1;
        return { userId: state.current.userId, token: state.current.token };
      },
      release(operation: CreationOperation): void {
        if (state.current.token === operation.token)
          state.current.inFlight = false;
      },
      isValid(operation: CreationOperation): boolean {
        return (
          state.current.live &&
          state.current.token === operation.token &&
          state.current.userId === operation.userId
        );
      },
    }),
    [],
  );
}
