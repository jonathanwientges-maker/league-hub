import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronIcon } from "./icons";

interface DisclosureProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

/** Collapsible section: height springs open (cross-fade under reduced motion), chevron rotates. */
export function Disclosure({ header, children, className, headerClassName, bodyClassName }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const bodyId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        className={headerClassName}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>{header}</span>
        <motion.span
          aria-hidden="true"
          style={{ display: "inline-flex", color: "var(--text-dim)" }}
          animate={{ rotate: open && !reduce ? 180 : 0 }}
          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        >
          <ChevronIcon />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            className={bodyClassName}
            style={{ overflow: "hidden" }}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : { type: "spring", bounce: 0, duration: 0.45 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
