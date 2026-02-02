import { FeedItem } from "@/types/signals";

export function interpretFeedItem(feed: FeedItem | null) {
  if (!feed) {
    return {
      headline: "Market observatory is live.",
      why: "Signals are proofs that move investor attention. Green = tailwind, red = headwind.",
    };
  }

  const t = (feed.text || "").toLowerCase();

  if (t.includes("senior hire") || t.includes("hire")) {
    return {
      headline: "Team strength increased.",
      why: "Hiring signals execution capacity and reduces perceived risk for investors.",
    };
  }
  if (t.includes("press") || t.includes("mention") || t.includes("media")) {
    return {
      headline: "Attention increased.",
      why: "Narrative distribution boosts inbound probability and social proof.",
    };
  }
  if (t.includes("customer") || t.includes("enterprise")) {
    return {
      headline: "Demand proof increased.",
      why: "Customer proof is a top de-risker; it accelerates investor receptivity.",
    };
  }
  if (t.includes("funding") || t.includes("rumor") || t.includes("round")) {
    return {
      headline: "Capital attention shifted.",
      why: "Capital flow signals change meeting velocity and close probability.",
    };
  }
  if (t.includes("product") || t.includes("launch") || t.includes("ship")) {
    return {
      headline: "Momentum increased.",
      why: "Shipping reinforces compounding advantage and raises conviction.",
    };
  }

  return {
    headline: "Signals updated.",
    why: "Each update changes perceived odds by shifting proof, momentum, or appetite.",
  };
}
