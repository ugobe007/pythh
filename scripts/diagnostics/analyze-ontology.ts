import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.bak" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyzeOntology() {
  try {
    console.log("📊 Ontology Analysis\n");

    // Get all ontology data
    const { data: allEntities } = await supabase
      .from("entity_ontologies")
      .select("entity_name, entity_type, confidence");

    if (!allEntities) {
      console.log("❌ No data");
      return;
    }

    // Group by entity_type
    const byType: Record<string, any[]> = {};
    allEntities.forEach((e: any) => {
      if (!byType[e.entity_type]) byType[e.entity_type] = [];
      byType[e.entity_type].push(e);
    });

    console.log("📋 Ontology Distribution:\n");
    Object.entries(byType).forEach(([type, entities]) => {
      const avgConf = (entities.reduce((s, e: any) => s + (e.confidence || 0), 0) / entities.length).toFixed(3);
      console.log(`  ${type}: ${entities.length} entities (avg conf: ${avgConf})`);
      console.log(
        `    Examples: ${entities
          .slice(0, 5)
          .map((e: any) => e.entity_name)
          .join(", ")}`
      );
    });

    // Now check what entities are appearing in events
    console.log("\n🔍 Entities Appearing in Events (sampling):\n");
    const { data: events } = await supabase
      .from("startup_events")
      .select("entities")
      .filter("entities", "neq", "[]")
      .limit(100);

    const appearingEntities = new Set();
    const eventEntityTypes = new Map();

    events?.forEach((e: any) => {
      e.entities?.forEach((ent: any) => {
        appearingEntities.add(ent.name);
        eventEntityTypes.set(ent.name, ent.role);
      });
    });

    console.log(`Found ${appearingEntities.size} unique entities in events\n`);

    // Cross-reference: which extracted entities match ontology?
    const matchedToOntology = Array.from(appearingEntities).filter(name =>
      allEntities.some((ont: any) => ont.entity_name === name)
    );

    console.log(`✅ Entities matched to ontology: ${matchedToOntology.length}`);
    if (matchedToOntology.length > 0) {
      console.log(`   Examples: ${matchedToOntology.slice(0, 10).join(", ")}`);
    }

    // Show unmatched
    const unmatchedSample = Array.from(appearingEntities)
      .filter(name => !allEntities.some((ont: any) => ont.entity_name === name))
      .slice(0, 20);

    console.log(`\n❌ Unmatched entities (sample): ${unmatchedSample.length} total`);
    unmatchedSample.forEach(name => {
      console.log(`   - ${name} (role: ${eventEntityTypes.get(name)})`);
    });
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

analyzeOntology();
