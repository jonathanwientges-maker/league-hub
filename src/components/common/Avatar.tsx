import type { CSSProperties } from "react";
import styles from "./Avatar.module.css";

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
}

export function Avatar({ url, name, size = 32 }: AvatarProps) {
  const style = { "--size": `${size}px` } as CSSProperties;

  if (url) {
    return <img className={styles.avatar} style={style} src={url} alt="" />;
  }

  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className={styles.fallback} style={style} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}
