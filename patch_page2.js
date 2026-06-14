const fs = require('fs');

let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

let modified = content;

// Replace 1: preview startX, startY
modified = modified.replace(
    /if\s*\(\s*pSkill\.skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?startY \+=[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                if (pSkill.skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                }`;
    }
);

// Replace 2: skill click startX, startY
modified = modified.replace(
    /if\s*\(\s*skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?startY \+=[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;
    }
);

// Replace 3: sync logic newX, newY
modified = modified.replace(
    /if\s*\(\s*skill\.deployment\?\.windup\s*\)\s*\{([\s\S]*?newY \+=?[\s\S]*?mToPx;\s*)\}/g,
    (match, p1) => {
        return match + `\n                                if (skill.deployment?.spawnOffset) {
                                    newX += Math.cos(sa) * skill.deployment.spawnOffset * mToPx;
                                    newY += Math.sin(sa) * skill.deployment.spawnOffset * mToPx;
                                }`;
    }
);

// Replace 4: rotation sync originX originY
const targetBlock = `                if (
                    ["self_instant", "self_mobile_aura"].includes(
                        skill.deployment?.type as string,
                    ) ||
                    skill.deployment?.windup
                ) {
                    skill.x =
                        originX +
                        Math.cos(sa) * skill.deployment.windup * mToPx;
                    skill.y =
                        originY +
                        Math.sin(sa) * skill.deployment.windup * mToPx;
                }`;

// replace it with regex ignoring spaces
const targetRegex = /if\s*\(\s*\["self_instant",\s*"self_mobile_aura"\]\.includes\([\s\S]*?skill\.deployment\?\.type[\s\S]*?\)\s*\|\|\s*skill\.deployment\?\.windup\s*\)\s*\{[\s\S]*?skill\.y\s*=\s*originY[\s\S]*?mToPx;\s*\}/g;

modified = modified.replace(targetRegex, (match) => {
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

fs.writeFileSync('src/app/strategies/page.tsx', modified, 'utf8');
console.log("Done");
