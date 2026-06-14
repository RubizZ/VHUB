const fs = require('fs');

let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

function replaceRobust(text, searchStr, replaceStr) {
    const searchNoCR = searchStr.replace(/\\r/g, '');
    const regex = new RegExp(searchNoCR.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\n/g, '\\\\r?\\\\n'), 'g');
    if (!regex.test(text)) {
        console.error("NOT FOUND: " + searchStr.substring(0, 50));
    }
    return text.replace(regex, replaceStr);
}

// 1. Replace the "DON'T translate" with translation
const s1 = `                        }
                        // DON'T translate for sweep projectiles - they're already fully rendered
                    } else {`;
const r1 = `                        }
                        ctx.translate(tx, ty);
                    } else {`;
content = replaceRobust(content, s1, r1);

// 2. Remove the duplicated sweep rendering block
// Find the start
const dupStart = `            } else if (getDeploymentType(skill) === "projectile_sweeping" && (skill.targetX !== undefined && skill.targetY !== undefined)) {`;
const dupEnd = `                // DON'T translate for sweep projectiles - they render the full area, not at the endpoint`;

const idxStart = content.indexOf(dupStart);
const idxEnd = content.indexOf(dupEnd, Math.max(0, idxStart));

if (idxStart !== -1 && idxEnd !== -1) {
    const nextLineIdx = content.indexOf('\\n', idxEnd);
    content = content.substring(0, idxStart) + content.substring(nextLineIdx + 1);
    console.log("Removed duplicated block");
} else {
    console.error("Duplicate block not found! start=" + idxStart + " end=" + idxEnd);
}

// 3. Allow circle geometry to be drawn
const sCircle = `} else if (geom.type === "circle" && getDeploymentType(skill) !== "projectile_sweeping") {`;
const rCircle = `} else if (geom.type === "circle") {`;
content = replaceRobust(content, sCircle, rCircle);

// 4. Allow generic geometries (rectangle, cone, trapezoid, line) to be drawn
const sGeneric = `            } else if (
                (geom.type === "rectangle" ||
                geom.type === "cone" ||
                geom.type === "trapezoid" ||
                geom.type === "line" ||
                (geom.type === "circle" && getDeploymentType(skill) !== "projectile_sweeping")) &&
                getDeploymentType(skill) !== "projectile_sweeping"
            ) {`;
const rGeneric = `            } else if (
                geom.type === "rectangle" ||
                geom.type === "cone" ||
                geom.type === "trapezoid" ||
                geom.type === "line"
            ) {`;
content = replaceRobust(content, sGeneric, rGeneric);

fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
console.log("Done");
