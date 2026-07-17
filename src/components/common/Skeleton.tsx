import clsx from "clsx";
import styles from "./Skeleton.module.css";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = "100%", height = "1em", className }: SkeletonProps) {
  return (
    <span
      className={clsx(styles.skeleton, className)}
      style={{ display: "block", width, height }}
      aria-hidden="true"
    />
  );
}
