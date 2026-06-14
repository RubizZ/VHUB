const fs = require('fs');
let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

// The block to delete is:
// } else if (getDeploymentType(skill) === "projectile_sweeping") {
//     // Preview circle for sweep projectile without target
//     ctx.save();
//     let sweepWidth = 0;
//     if (geom.type === "circle") { ... }
//     ...
//     ctx.restore();
// }

const searchStr = `            } else if (getDeploymentType(skill) === "projectile_sweeping") {
                // Preview circle for sweep projectile without target
                ctx.save();
                let sweepWidth = 0;
                if (geom.type === "circle") {
                    sweepWidth = (geom.radius !== undefined ? geom.radius : getGeomWidth(geom) / 2) * 2 * mToPx;
                } else if (geom.type === "rectangle" || geom.type === "line") {
                    sweepWidth = getGeomWidth(geom) * mToPx;
                } else if (geom.type === "trapezoid") {
                    sweepWidth = getGeomWidth(geom) * mToPx;
                }
                
                if (sweepWidth > 0) {
                    ctx.beginPath();
                    ctx.arc(0, 0, sweepWidth / 2, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.globalAlpha = strokeAlpha;
                    ctx.lineWidth = 4 / scale;
                    ctx.save();
                    ctx.clip();
                    ctx.stroke();
                    ctx.restore();
                    ctx.globalAlpha = baseAlpha;
                }
                ctx.restore();
            }`;

// Replace ignoring carriage returns to be robust
const regex = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n'), 'g');
content = content.replace(regex, '');

fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
console.log("Done");
