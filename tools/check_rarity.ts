
import fs from 'fs';
import path from 'path';

const ASCII_DIR = path.join(process.cwd(), 'ASCII_FINAL');
const tokenId = process.argv[2];

if (!tokenId) {
    console.error("Usage: tsx tools/check_rarity.ts <tokenId>");
    process.exit(1);
}

async function main() {
    const filePath = path.join(ASCII_DIR, `${tokenId}.json`);

    try {
        await fs.promises.access(filePath);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const json = JSON.parse(content);

        console.log(`\n--- Metadata for Token #${tokenId} ---`);

        const rarityAttr = json.attributes.find((a: any) => a.trait_type === 'Rarity Score');
        const rarityScore = rarityAttr ? rarityAttr.value : "N/A";

        console.log(`Rarity Score: ${rarityScore}`);
        console.log("Full Attributes:", JSON.stringify(json.attributes, null, 2));

    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error(`Error: File for Token ID ${tokenId} not found.`);
        } else {
            console.error("Error reading file:", err);
        }
    }
}

main();
