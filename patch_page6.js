const fs = require('fs');

let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

// 1. Replace the "DON'T translate" comment with the actual translation.
content = content.replace(/\/\/\s*DON'T translate for sweep projectiles - they're already fully rendered/g, 'ctx.translate(tx, ty);');

// 2. Remove the duplicated sweep rendering block.
// It starts with `} else if (getDeploymentType(skill) === "projectile_sweeping" && (skill.targetX !== undefined && skill.targetY !== undefined)) {`
// and ends with `// DON'T translate for sweep projectiles - they render the full area, not at the endpoint`
const dupRegex = /\}\s*else\s*if\s*\(\s*getDeploymentType\(\s*skill\s*\)\s*===\s*"projectile_sweeping"\s*&&\s*\(\s*skill\.targetX\s*!==\s*undefined\s*&&\s*skill\.targetY\s*!==\s*undefined\s*\)\s*\)\s*\{[\s\S]*?\/\/\s*DON'T translate for sweep projectiles - they render the full area, not at the endpoint\s*\r?\n?/g;
content = content.replace(dupRegex, '');

// 3. Allow circle geometry to be drawn
const circleRegex = /\}\s*else\s*if\s*\(\s*geom\.type\s*===\s*"circle"\s*&&\s*getDeploymentType\(\s*skill\s*\)\s*!==\s*"projectile_sweeping"\s*\)\s*\{/g;
content = content.replace(circleRegex, '} else if (geom.type === "circle") {');

// 4. Allow generic geometries to be drawn
const genericRegex = /\}\s*else\s*if\s*\(\s*\(\s*geom\.type\s*===\s*"rectangle"\s*\|\|\s*geom\.type\s*===\s*"cone"\s*\|\|\s*geom\.type\s*===\s*"trapezoid"\s*\|\|\s*geom\.type\s*===\s*"line"\s*\|\|\s*\(\s*geom\.type\s*===\s*"circle"\s*&&\s*getDeploymentType\(\s*skill\s*\)\s*!==\s*"projectile_sweeping"\s*\)\s*\)\s*&&\s*getDeploymentType\(\s*skill\s*\)\s*!==\s*"projectile_sweeping"\s*\)\s*\{/g;
const genericReplacement = `            } else if (
                geom.type === "rectangle" ||
                geom.type === "cone" ||
                geom.type === "trapezoid" ||
                geom.type === "line"
            ) {`;
content = content.replace(genericRegex, genericReplacement);

fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
console.log("Done");
