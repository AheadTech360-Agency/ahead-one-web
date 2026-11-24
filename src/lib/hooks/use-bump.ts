"use client";

import { useState } from "react";

/** Changes whenever `value` changes after mount; use as a React key to replay a short bump. */
export function useBump(value: unknown): number {
  const [prev, setPrev] = useState(value);
  const [n, setN] = useState(0);
  if (prev !== value) {
    setPrev(value);
    setN((x) => x + 1);
  }
  return n;
}
