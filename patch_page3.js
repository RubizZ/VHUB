const fs = require('fs');

let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

const s1 = `                if (pSkill.skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        pSkill.skill.deployment?.windup *
                        mToPx;
                }`;
const r1 = s1 + `\n                if (pSkill.skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * pSkill.skill.deployment.spawnOffset * mToPx;
                }`;

const s2 = `                if (
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
const r2 = s2 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

const s3 = `                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        (skill.deployment?.windup || 0) *
                        mToPx;
                }`;
const r3 = s3 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

const s4 = `                if (
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
const r4 = `                if (
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

const s5 = `                                if (skill.deployment?.windup) {
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
const r5 = s5 + `\n                                if (skill.deployment?.spawnOffset) {
                                    newX += Math.cos(sa) * skill.deployment.spawnOffset * mToPx;
                                    newY += Math.sin(sa) * skill.deployment.spawnOffset * mToPx;
                                }`;

const s6 = `                if (skill.deployment?.windup) {
                    startX +=
                        Math.cos(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                    startY +=
                        Math.sin(playerToMouseAngle) *
                        skill.deployment?.windup *
                        mToPx;
                }`;
const r6 = s6 + `\n                if (skill.deployment?.spawnOffset) {
                    startX += Math.cos(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                    startY += Math.sin(playerToMouseAngle) * skill.deployment.spawnOffset * mToPx;
                }`;

// Clean strings to ignore carriage returns when comparing and replace robustly
function replaceRobust(text, searchStr, replaceStr) {
    const searchNoCR = searchStr.replace(/\r/g, '');
    const regex = new RegExp(searchNoCR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n'), 'g');
    return text.replace(regex, replaceStr);
}

content = replaceRobust(content, s1, r1);
content = replaceRobust(content, s2, r2);
content = replaceRobust(content, s3, r3);
content = replaceRobust(content, s4, r4);
content = replaceRobust(content, s5, r5);
content = replaceRobust(content, s6, r6);

fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
console.log("Done");
