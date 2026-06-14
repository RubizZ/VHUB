const fs = require('fs');
let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

const emptyStateStart = content.indexOf('function EmptyState({ message }: { message: string }) {');
if (emptyStateStart === -1) {
    console.error("EmptyState not found");
    process.exit(1);
}

// Find the end of the EmptyState function. It's a simple function, we can just look for the next "}" that starts on a new line, or just find the first "}" after `</p> </div> );`.
const emptyStateEnd = content.indexOf('}', emptyStateStart);
if (emptyStateEnd !== -1) {
    // wait, EmptyState has multiple closing braces.
    // Let's just find `    );\n}`
    const exactEnd = content.indexOf('    );\n}', emptyStateStart);
    if (exactEnd !== -1) {
        content = content.substring(0, exactEnd + 6);
        fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
        console.log("Truncated successfully. New length: " + content.length);
    } else {
        // try with \r\n
        const exactEndCRLF = content.indexOf('    );\r\n}', emptyStateStart);
        if (exactEndCRLF !== -1) {
            content = content.substring(0, exactEndCRLF + 7);
            fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
            console.log("Truncated successfully. New length: " + content.length);
        } else {
            console.error("End of EmptyState not found exactly.");
        }
    }
}
