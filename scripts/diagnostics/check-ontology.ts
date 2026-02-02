import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.bak" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkOntology() {
  try {
    // Get ontology entities by confidence
    const { data: entities, error: err1 } = await supabase
      .from("entity_ontologies")
      .select("entity_name, category, confidence")
      .order("confidence", { ascending: false })
      .limit(100);

    console.log("📊 Top 100 Ontology Entities (by confidence):\n");
    if (entities && entities.length > 0) {
      entities.forEach((e, i) => {
        console.log(
          `${i + 1}. ${e.entity_name.padEnd(30)} | ${(e.category || "unknown").padEnd(15)} | Conf: ${e.confidence?.toFixed(3)}`
        );
      });
    } else {
      console.log("❌ No ontology entities found");
    }

    // Get total count
    const { count: total } = await supabase
      .from("entity_ontologies")
      .select("*", { count: "exact", head: true });

    console.log(`\n✅ Total ontology entities: ${total || 0}`);

    // Sample events to see what entities are appearing
    console.log("\n📡 Sample Events (last 10) to see entity extraction:\n");
    const { data: events } = await supabase
      .from("startup_events")
      .select("entities, subject, object, verb, source_publisher")
      .order("occurred_at", { ascending: false })
      .limit(10);

    if (events) {
      events.forEach((e, i) => {
        const entityNames = e.entities
          ?.map((ent: any) => `${ent.name}(${ent.role})`)
          .join(" | ");
        console.log(`${i + 1}. [${e.source_publisher}]`);
        console.log(`   Entities: ${entityNames || "NONE"}`);
        console.log(`   Frame: ${e.subject} -> ${e.verb} -> ${e.object}`);
        console.log("");
      });
    }

    // Check how many parsed events have NO entities (filtered out)
    const { data: noEntityEvents, count: noEntityCount } = await supabase
      .from("startup_events")
      .select("id", { count: "exact" })
      .eq("entities", "[]")
      .limit(1);

    console.log(`\n⚠️  Events with NO entities (filtered): ${noEntityCount || 0}`);

    // Check events with entities but graph_safe=false
    const { data: filteredButHasEntities } = await supabase
      .from("startup_events")
      .select("id, extraction_meta, entities, source_publisher")
      .filter("entities", "neq", "[]")
      .limit(20);

    const graphSafeFalse = filteredButHasEntities?.filter(
      (e: any) => !e.extraction_meta?.graph_safe
    ).length || 0;

    console.log(`📌 Events with entities but graph_safe=false: ${graphSafeFalse}`);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

checkOntology();
