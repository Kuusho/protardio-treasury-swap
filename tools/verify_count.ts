
import fs from 'fs';
import path from 'path';

const ASCII_DIR = path.join(process.cwd(), 'ASCII_FINAL');

async function main() {
    try {
        const dir = await fs.promises.opendir(ASCII_DIR);
        let count = 0;

        for await (const dirent of dir) {
            if (dirent.isFile() && dirent.name.endsWith('.json')) {
                count++;
            }
        }

        console.log(`\nTotal JSON files in ASCII_FINAL: ${count}`);

    } catch (err) {
        console.error("Error counting files:", err);
    }
}

main();
