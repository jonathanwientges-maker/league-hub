import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The one orchestrated page-load reveal per page (Step 6.0 Motion): wrap a
 * page's cards in <RevealGroup>, each card in <RevealItem>, and they
 * stagger in as a fade/slide. Respects prefers-reduced-motion.
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: shouldReduceMotion ? 0 : 0.08 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: shouldReduceMotion ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
