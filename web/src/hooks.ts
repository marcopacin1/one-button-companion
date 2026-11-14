import { useEffect, useState } from "react";

export type Load<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: T };

/** Runs `fetcher` whenever `deps` change, cancelling the previous request. */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetcher(ctrl.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: Error) => {
        if (!ctrl.signal.aborted) setState({ status: "error", error });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
