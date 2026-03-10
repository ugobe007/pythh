/**
 * PythhExplainerBlock — Single concise line explaining what Pythh does
 */

import { Link } from "react-router-dom";

export default function PythhExplainerBlock() {
  return (
    <p className="text-sm text-zinc-400 leading-relaxed">
      Drop your URL → we score you, rank your investor matches by signals, and show you when to pitch.{" "}
      <Link to="/platform" className="text-cyan-400 hover:text-cyan-300 transition-colors">
        How it Works
      </Link>
    </p>
  );
}
