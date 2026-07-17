import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import clsx from "clsx";
import styles from "./Card.module.css";

type CardProps<T extends ElementType> = {
  as?: T;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export function Card<T extends ElementType = "div">({
  as,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Component = as ?? "div";
  return (
    <Component
      className={clsx(styles.card, interactive && styles.interactive, className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
