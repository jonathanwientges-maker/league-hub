import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import styles from "./Sheet.module.css";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Apple's drawer spring: damping ~0.8 / response 0.3 reads as bounce 0.2, 0.4s. */
const SHEET_SPRING = { type: "spring", bounce: 0.2, duration: 0.4 } as const;
const POPOVER_SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;
const FADE = { duration: 0.16, ease: "easeOut" } as const;

/** Momentum projection (Designing Fluid Interfaces): where would the drag land if released now? */
function project(velocity: number, rate = 0.998) {
  return ((velocity / 1000) * rate) / (1 - rate);
}

/**
 * Bottom sheet on phones (draggable, flick-to-dismiss, velocity handed to the
 * spring), anchored popover under the header on desktop. Reduced motion
 * swaps both for a short cross-fade.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 769px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (!isDesktop) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, isDesktop]);

  const onDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const height = panelRef.current?.offsetHeight ?? 300;
    // Decide by where the flick is heading, not where the finger let go.
    if (info.offset.y + project(info.velocity.y) > height * 0.4) onClose();
  };

  const initial = reduce ? { opacity: 0 } : isDesktop ? { opacity: 0, scale: 0.96, y: -6 } : { y: "100%" };
  const shown = reduce ? { opacity: 1 } : isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 };
  const transition = reduce ? FADE : isDesktop ? POPOVER_SPRING : SHEET_SPRING;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={styles.root}>
          <motion.div
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={initial}
            animate={shown}
            exit={initial}
            transition={transition}
            drag={reduce || isDesktop ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            {!isDesktop && <span className={styles.grabber} aria-hidden="true" />}
            <h2 className={styles.title}>{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
