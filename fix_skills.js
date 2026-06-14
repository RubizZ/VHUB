const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'strategies', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Fix imports
content = content.replace(
    /MechanicsData,\s*EffectsData,\s*DeploymentType,/g,
    'type DeploymentMechanics,\n    type LifetimeMechanics,\n    type ResolutionMechanics,'
);

// Fix CanvasSkill interface
content = content.replace(
    /mechanics\?:\s*any;\s*effects\?:\s*any;/g,
    'deployment?: DeploymentMechanics;\n    lifetime?: LifetimeMechanics;\n    resolution?: ResolutionMechanics;'
);

// hydrateSkills
content = content.replace(
    /if \(\s*!s\.mechanics \|\|\s*!s\.effects \|\|[\s\S]*?modified = true;\s*\}/g,
    `if (
                    JSON.stringify(s.deployment) !== JSON.stringify(globalSkill.deployment) ||
                    JSON.stringify(s.lifetime) !== JSON.stringify(globalSkill.lifetime) ||
                    JSON.stringify(s.resolution) !== JSON.stringify(globalSkill.resolution)
                ) {
                    s.deployment = globalSkill.deployment;
                    s.lifetime = globalSkill.lifetime;
                    s.resolution = globalSkill.resolution;
                    modified = true;
                }`
);

// Replace properties mapping
// skill.mechanics?.deploymentType -> skill.deployment?.type
content = content.replace(/\.mechanics\?\.deploymentType/g, '.deployment?.type');
content = content.replace(/\.mechanics\?\.windup/g, '.deployment?.windup');
content = content.replace(/\.mechanics\?\.projectileMaxDistance/g, '.deployment?.projectileMaxDistance');
content = content.replace(/\.mechanics\?\.projectileSpeed/g, '.deployment?.projectileSpeed');
content = content.replace(/\.mechanics\?\.castRange/g, '.deployment?.castRange');
content = content.replace(/\.mechanics\?\.duration/g, '.lifetime?.duration');
content = content.replace(/\.mechanics\?\.geometry/g, '.lifetime?.geometry');

content = content.replace(/\.mechanics\.deploymentType/g, '.deployment.type');
content = content.replace(/\.mechanics\.windup/g, '.deployment.windup');
content = content.replace(/\.mechanics\.projectileMaxDistance/g, '.deployment.projectileMaxDistance');
content = content.replace(/\.mechanics\.projectileSpeed/g, '.deployment.projectileSpeed');
content = content.replace(/\.mechanics\.castRange/g, '.deployment.castRange');
content = content.replace(/\.mechanics\.duration/g, '.lifetime.duration');
content = content.replace(/\.mechanics\.geometry/g, '.lifetime.geometry');

// (skill.mechanics as any)
content = content.replace(/\(skill\.mechanics \|\| \{\}\)/g, '(skill.deployment || {})');
content = content.replace(/\(skill\.mechanics as any\)/g, '(skill.deployment as any)');
content = content.replace(/pSkill\.skill\.mechanics/g, 'pSkill.skill.deployment');
content = content.replace(/skill\.mechanics/g, 'skill.deployment');

content = content.replace(/pSkill\.skill\.effects/g, 'pSkill.skill.lifetime?.effects');
content = content.replace(/skill\.effects/g, 'skill.lifetime?.effects');

// UndoAction type
content = content.replace(
    /mechanics:\s*pSkill\.skill\.deployment,\s*effects:\s*pSkill\.skill\.lifetime\?\.effects,/g,
    'deployment: pSkill.skill.deployment,\n                lifetime: pSkill.skill.lifetime,\n                resolution: pSkill.skill.resolution,'
);

// Fix unmapped getProjRangeAndFixed
content = content.replace(
    /function getProjRangeAndFixed\(skill: \{ deployment\?: any; unlinked\?: boolean \}\) \{/g,
    'function getProjRangeAndFixed(skill: { deployment?: any; lifetime?: any; unlinked?: boolean }) {'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replacements done!');
