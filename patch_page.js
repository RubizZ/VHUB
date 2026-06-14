const fs = require('fs');

let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

const b1 = `                if (pSkill.skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                }`;
const r1 = b1 + `\n                if (pSkill.skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                }`;

const b2 = `                if (
                    skill.deployment?.windup
                ) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                }`;
const r2 = b2 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

const b3 = `                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        (skill.deployment?.windup || 0) *
                        mToPx;
                }`;
const r3 = b3 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

const b4 = `                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                }`;
const r4 = b4 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

let modified = content;
modified = modified.replace(b1, r1);
modified = modified.replace(b2, r2);
modified = modified.replace(b3, r3);
modified = modified.replace(b4, r4);

const b5 = `                                if (skill.deployment?.windup) {
                                    newX =
                                        agent.x +
                                        Math.cos(sa) *
                                            skill.deployment?.windup *
                                            mToPx;
                                    newY =
                                        agent.y +
                                        Math.sin(sa) *
                                            skill.deployment?.windup *
                                            mToPx;
                                }`;
const r5 = b5 + `\n                                if (skill.deployment?.spawnOffset) {
                                    newX += Math.cos(sa) * skill.deployment.spawnOffset * mToPx;
                                    newY += Math.sin(sa) * skill.deployment.spawnOffset * mToPx;
                                }`;
modified = modified.replace(b5, r5);

const b6 = `                if (
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
const r6 = `                if (
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
modified = modified.replace(b6, r6);

fs.writeFileSync('src/app/strategies/page.tsx', modified, 'utf8');

console.log("Done");
