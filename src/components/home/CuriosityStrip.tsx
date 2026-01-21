/**
 * CURIOSITY STRIP — Front Page Contract
 * ======================================
 * 
 * Rotating intrigue lines. No explanation. No instruction.
 * Creates desire to know more.
 */

import { HOME_CONTENT } from "@/config/homeContent";
import { useEffect, useState } from "react";

export function CuriosityStrip() {
  const [index, setIndex] = useState(0);
  const lines = HOME_CONTENT.curiosityLines;

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % lines.length);
    }, 4000);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <section className="mt-6 text-neutral-500 text-sm">
      {lines[index]}
    </section>
  );
}
