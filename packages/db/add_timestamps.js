const fs = require('fs');

function main() {
    const filePath = "e:/AI/tomtat.com.vn/story-review-app/packages/db/src/schema.ts";
    let content = fs.readFileSync(filePath, "utf-8");

    // Split by table definitions
    const parts = content.split(/(export const \w+ = pgTable\([^,]+,\s*\{)/);

    if (parts.length === 1) {
        console.log("No pgTable found or regex failed.");
        process.exit(1);
    }

    let out = [parts[0]];
    for (let i = 1; i < parts.length; i += 2) {
        const header = parts[i];
        const bodyAndRest = parts[i + 1];

        let braceCount = 1;
        let pos = 0;
        let inString = false;
        let stringChar = null;

        while (pos < bodyAndRest.length && braceCount > 0) {
            const char = bodyAndRest[pos];
            if (!inString) {
                if (char === "'" || char === '"' || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            } else {
                if (char === stringChar) {
                    if (pos === 0 || bodyAndRest[pos - 1] !== '\\') {
                        inString = false;
                    }
                }
            }
            pos++;
        }

        const columnsBlock = bodyAndRest.substring(0, pos - 1);
        const rest = bodyAndRest.substring(pos - 1);

        const hasUpdated = columnsBlock.includes('updatedAt:');
        const hasDeleted = columnsBlock.includes('deletedAt:');

        let additions = [];
        if (!hasUpdated) additions.push("    updatedAt: timestamp('updated_at').defaultNow(),");
        if (!hasDeleted) additions.push("    deletedAt: timestamp('deleted_at'),");

        let newColumnsBlock = columnsBlock;
        if (additions.length > 0) {
            let colsClean = columnsBlock.trimEnd();
            if (colsClean && !colsClean.endsWith(',') && !colsClean.endsWith('{')) {
                colsClean += ',';
            }
            newColumnsBlock = colsClean + "\n" + additions.join("\n") + "\n";
        }

        out.push(header + newColumnsBlock + rest);
    }

    fs.writeFileSync(filePath, out.join(''), "utf-8");
    console.log("Done adding timestamps to tables.");
}

main();
