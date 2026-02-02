import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.bak" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSchema() {
  try {
    console.log("🔍 Checking entity_ontologies table structure...\n");

    // Get all columns from a raw query
    const { data: allData } = await supabase
      .from("entity_ontologies")
      .select("*")
      .limit(5);

    if (allData && allData.length > 0) {
      console.log("Column names in entity_ontologies:");
      Object.keys(allData[0]).forEach(col => {
        console.log(`  - ${col}`);
      });

      console.log("\n📌 Sample ontology records:\n");
      allData.forEach((row, i) => {
        console.log(`Record ${i + 1}:`);
        Object.entries(row).forEach(([key, val]) => {
          if (key !== "id" && key !== "created_at" && key !== "updated_at") {
            console.log(`  ${key}: ${JSON.stringify(val).substring(0, 80)}`);
          }
        });
        console.log("");
      });
    } else {
      console.log("❌ No records found in entity_ontologies");
    }

    // Check total count
    const { count } = await supabase
      .from("entity_ontologies")
      .select("*", { count: "exact", head: true });

    console.log(`Total records: ${count}`);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

checkSchema();
