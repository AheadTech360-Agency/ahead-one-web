import { useState } from "react";

/** Turns true the first time `value` is true and stays true: mount a lazy component on first use, then keep it. */
export function useEverTrue(value: boolean) {
  const [ever, setEver] = useState(value);
  if (value && !ever) setEver(true);
  return ever || value;
}
