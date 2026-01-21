/**
 * CURIOSITY ANCHOR — Leaking Map Layout
 * ======================================
 * 
 * Bottom-left intrigue. Unresolved tension.
 * 
 * INVARIANTS:
 * • One rotating line
 * • No explanation
 * • No instructions
 * • No marketing slogans
 * • No product narration
 */

import { useEffect, useState } from "react";

const LINES = [
  "Capital moves before founders notice.",
  "Your narrative is legible to some funds and invisible to others.",
  "Some investors are warming up to categories you don't expect.",
];

export function CuriosityAnchor() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % LINES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-neutral-500 text-sm">
      {LINES[index]}
    </div>
  );
}
