
import fs from 'fs';
import path from 'path';

const ASCII_DIR = path.join(process.cwd(), 'ASCII_FINAL');

async function main() {
    try {
        const dir = await fs.promises.opendir(ASCII_DIR);
        let count = 0;
        let selectedFile = null;

        // Reservoir sampling to pick one random file without loading all into memory
        for await (const dirent of dir) {
            if (!dirent.isFile() || !dirent.name.endsWith('.json')) continue;
            count++;
            if (Math.random() < 1 / count) {
                selectedFile = dirent.name;
            }
        }

        if (!selectedFile) {
            console.log("No JSON files found in ASCII_FINAL.");
            return;
        }

        const content = await fs.promises.readFile(path.join(ASCII_DIR, selectedFile), 'utf-8');
        console.log(`\n--- Random File: ${selectedFile} ---`);
        console.log(content);
        console.log("\n(Schema structure shown above)");

    } catch (err) {
        console.error("Error peeking:", err);
    }
}

main();
