"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  formatter?: (n: number) => string;
}

export function AnimatedCounter({ value, decimals = 0, suffix = "", duration = 1.4, formatter }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(latest) {
        const text = formatter
          ? formatter(latest)
          : latest.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        node.textContent = `${text}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, value, decimals, suffix, duration, formatter]);

  return <span ref={ref} />;
}
