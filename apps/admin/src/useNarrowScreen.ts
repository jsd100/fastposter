import { useEffect, useState } from "react";

/**
 * The media query the admin stylesheet uses for its phone layout. Reading it
 * before the first paint keeps a record page from rendering the desktop table
 * for one frame on a narrow screen, and antd's `useBreakpoint` only answers
 * after its effect has run.
 */
const NARROW = "(max-width: 767px)";

export function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() =>
    window.matchMedia(NARROW).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return narrow;
}
