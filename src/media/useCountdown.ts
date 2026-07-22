import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Live-ticking "hh:mm:ss until target" string, updated once a second. */
export function useCountdown(target: Date): string {
  const [label, setLabel] = useState(() => formatRemaining(target.getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatRemaining(target.getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  return label;
}
