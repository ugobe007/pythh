import fs from "fs";

const file = "/Users/leguplabs/Desktop/hot-honey/src/services/rss/entityExtractor.ts";
let content = fs.readFileSync(file, "utf8");

// Fix all regex escaping issues - double escape backslashes
content = content.replace(/\\s/g, '\\\\s');
content = content.replace(/\\d/g, '\\\\d');
content = content.replace(/\\b/g, '\\\\b');
content = content.replace(/\\$/g, '\\\\$');

fs.writeFileSync(file, content, "utf8");
console.log("✅ Fixed regex escaping in entityExtractor.ts");
