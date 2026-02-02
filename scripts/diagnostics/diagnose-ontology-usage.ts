import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.bak" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function diagnoseOntologyUsage() {
  try {
    console.log("🔬 Diagnosing Ontology Usage in Parser\n");

    // Get all ontology entities
    const { data: ontology } = await supabase
      .from("entity_ontologies")
      .select("entity_name, entity_type");

    if (!ontology) {
      console.log("❌ Failed to load ontology");
      return;
    }

    const ontologyNames = new Set(ontology.map((e: any) => e.entity_name.toLowerCase()));
    console.log(`Ontology size: ${ontologyNames.size} entities\n`);

    // Get all events with entities
    const { data: allEvents } = await supabase
      .from("startup_events")
      .select("entities, extraction_meta, occurred_at")
      .filter("entities", "neq", "[]")
      .order("occurred_at", { ascending: false })
      .limit(500);

    if (!allEvents) {
      console.log("❌ Failed to fetch events");
      return;
    }

    let graphSafeCount = 0;
    let graphSafeWithOntology = 0;
    let ontologyFoundInFrames = 0;
    const ontologyMatches: Map<string, number> = new Map();

    allEvents.forEach((evt: any) => {
      if (evt.extraction_meta?.graph_safe) {
        graphSafeCount++;
      }

      evt.entities?.forEach((ent: any) => {
        const lowerName = ent.name.toLowerCase();
        if (ontologyNames.has(lowerName)) {
          ontologyFoundInFrames++;
          ontologyMatches.set(ent.name, (ontologyMatches.get(ent.name) || 0) + 1);

          if (evt.extraction_meta?.graph_safe) {
            graphSafeWithOntology++;
          }
        }
      });
    });

    console.log("📊 Results:");
    console.log(`  Events analyzed: ${allEvents.length}`);
    console.log(`  Events with graph_safe=true: ${graphSafeCount}`);
    console.log(`  Ontology entities found in frames: ${ontologyFoundInFrames}`);
    console.log(`  Ontology entities in graph_safe events: ${graphSafeWithOntology}`);

    console.log("\n🎯 Top Ontology Entities Found in Frames:");
    const sorted: any = [...ontologyMatches.entries()]
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 20);

    sorted.forEach((entry: any) => {
      const name = entry[0];
      const count = entry[1];
      const type = ontology.find((e: any) => e.entity_name.toLowerCase() === name.toLowerCase())?.entity_type;
      console.log(`  ${name.padEnd(25)} (${type}): ${count} times`);
    });

    // Check the breakdown
    console.log("\n📈 Entity Type Distribution in Frames:");
    const typeCount: Record<string, number> = {};
    sorted.forEach((entry: any) => {
      const name = entry[0];
      const type =
        ontology.find((e: any) => e.entity_name.toLowerCase() === name.toLowerCase())?.entity_type || "UNKNOWN";
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Calculate coverage
    const ontologyUsageRate = ((ontologyFoundInFrames / allEvents.length) * 100).toFixed(2);
    console.log(`\n💡 Ontology usage rate: ${ontologyUsageRate}% of entities are from ontology`);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

diagnoseOntologyUsage();
