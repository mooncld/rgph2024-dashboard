"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  formatter?: (n: number) => string;
}

// Framer Motion's documented animated-counter pattern: a MotionValue's text
// is written straight to the DOM by the library itself (subscription-based,
// outside React's render cycle) rather than us mutating a ref or driving
// React state by hand on every tick.
export function AnimatedCounter({ value, decimals = 0, suffix = "", duration = 1.4, formatter }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => {
    const text = formatter
      ? formatter(latest)
      : latest.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${text}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] });
    // requestAnimationFrame is throttled or fully paused for a backgrounded/
    // hidden tab (e.g. the user switches away right after navigating), which
    // can stall the tween indefinitely. This guarantees the true value lands
    // within a bounded time regardless — a no-op if the animation already
    // finished on its own.
    const safety = setTimeout(() => motionValue.jump(value), duration * 1000 + 500);
    return () => {
      controls.stop();
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <motion.span>{rounded}</motion.span>;
}
