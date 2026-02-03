import React from "react";
import { SurfaceMode, FeedItem } from "../types";

function interpretEvent(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes("hire") || lower.includes("talent")) {
    return "Signals execution capacity; increases investor confidence.";
  }
  if (lower.includes("press") || lower.includes("media") || lower.includes("coverage")) {
    return "Raises awareness; increases inbound probability.";
  }
  if (lower.includes("customer") || lower.includes("client")) {
    return "Validates demand + pricing power; increases round velocity.";
  }
  if (lower.includes("funding") || lower.includes("capital")) {
    return "Validates traction; creates competitive urgency.";
  }
  if (lower.includes("product") || lower.includes("launch") || lower.includes("feature")) {
    return "Demonstrates execution momentum; strengthens competitive position.";
  }
  if (lower.includes("alignment") || lower.includes("investor")) {
    return "Increases fundraising probability; signals market validation.";
  }
  
  return "Signals momentum; increases market confidence.";
}

export default function TranslatorLine({
  mode,
  latestFeed,
}: {
  mode: SurfaceMode;
  latestFeed: FeedItem | null;
}) {
  let message = "";
  let subtext = "";

  if (mode === "global") {
    message = "Market observatory is live.";
    subtext = "Inject your URL to compute your fundraising window and alignment.";
  } else if (mode === "injecting") {
    message = "Scanning your footprint…";
    subtext = "Extracting signals and computing deltas.";
  } else if (mode === "reveal" || mode === "tracking") {
    if (latestFeed) {
      const impacts = (latestFeed.impacts ?? []).slice(0, 2);
      const impactStr = impacts
        .map((i) => `${i.channelId.replace(/_/g, " ")} ${i.delta > 0 ? "+" : ""}${i.delta}`)
        .join(", ");
      
      message = `Your odds are moving because: ${impactStr}`;
      subtext = interpretEvent(latestFeed.text);
    } else {
      message = "Tracking live signals…";
      subtext = "Events will update your odds in real time.";
    }
  }

  return (
    <div className="translatorLine">
      <div className="translatorMessage">{message}</div>
      {subtext && <div className="translatorSub">{subtext}</div>}
    </div>
  );
}
