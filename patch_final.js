const fs = require('fs');
let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

// --- 1. SPAWN OFFSET PATCHES ---

content = content.replace(
    /if\s*\(\s*pSkill\.skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?startY \+=[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                if (pSkill.skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                }`;
    }
);

content = content.replace(
    /if\s*\(\s*skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?startY \+=[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;
    }
);

content = content.replace(
    /if\s*\(\s*skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?newY \+=?[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                                if (skill.deployment?.spawnOffset) {
                                    newX += Math.cos(sa) * skill.deployment.spawnOffset * mToPx;
                                    newY += Math.sin(sa) * skill.deployment.spawnOffset * mToPx;
                                }`;
    }
);

const targetRegex = /if\s*\(\s*\["self_instant",\s*"self_mobile_aura"\]\.includes\([\s\S]*?skill\.deployment\?\.type[\s\S]*?\)\s*\|\|\s*skill\.deployment\?\.windup\s*\)\s*\{[\s\S]*?skill\.y\s*=\s*originY[\s\S]*?mToPx;\s*\}/g;
content = content.replace(targetRegex, (match) => {
    return `                if (
                    ["self_instant", "self_mobile_aura"].includes(
                        skill.deployment?.type as string,
                    ) ||
                    skill.deployment?.windup || skill.deployment?.spawnOffset
                ) {
                    skill.x =
                        originX +
                        Math.cos(sa) * ((skill.deployment.windup || 0) + (skill.deployment.spawnOffset || 0)) * mToPx;
                    skill.y =
                        originY +
                        Math.sin(sa) * ((skill.deployment.windup || 0) + (skill.deployment.spawnOffset || 0)) * mToPx;
                }`;
});

// --- 2. SWEEP RENDERING PATCHES ---

content = content.replace(/\/\/\s*DON'T translate for sweep projectiles - they're already fully rendered/g, 'ctx.translate(tx, ty);');

const dupRegex = /\}\s*else\s*if\s*\(\s*getDeploymentType\(\s*skill\s*\)\s*===\s*"projectile_sweeping"\s*&&\s*\(\s*skill\.targetX\s*!==\s*undefined\s*&&\s*skill\.targetY\s*!==\s*undefined\s*\)\s*\)\s*\{[\s\S]*?\/\/\s*DON'T translate for sweep projectiles - they render the full area, not at the endpoint\s*\r?\n?/g;
content = content.replace(dupRegex, '');

const circleRegex = /\}\s*else\s*if\s*\(\s*geom\.type\s*===\s*"circle"\s*&&\s*getDeploymentType\(\s*skill\s*\)\s*!==\s*"projectile_sweeping"\s*\)\s*\{/g;
content = content.replace(circleRegex, '} else if (geom.type === "circle") {');

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
