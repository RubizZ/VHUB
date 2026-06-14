const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'strategies', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// fix undefined in .includes
content = content.replace(/\.includes\(([^)]*?\.deployment\?\.type[^)]*?)\)/g, '.includes(($1) as string)');
content = content.replace(/\.includes\(([^)]*?\.deployment\.type[^)]*?)\)/g, '.includes(($1) as string)');

// fix geom.length
content = content.replace(/geom\.length/g, '(geom as any).length');
// fix geom.radius
content = content.replace(/geom\.radius/g, '(geom as any).radius');

// fix any remaining mechanics property assignment or access
content = content.replace(/mechanics:\s*pSkill\.skill\.deployment/g, 'deployment: pSkill.skill.deployment');
content = content.replace(/mechanics:\s*skill\.deployment/g, 'deployment: skill.deployment');
content = content.replace(/effects:\s*pSkill\.skill\.lifetime/g, 'lifetime: pSkill.skill.lifetime');

// Fix signature of UndoAction and CanvasSkill
content = content.replace(/effects:\s*any;/g, 'lifetime?: any;');
content = content.replace(/mechanics:\s*any;/g, 'deployment?: any;');

// Fix getProjRangeAndFixed signature mismatch (from { deployment?: any; unlinked?: boolean } to { deployment?: any; lifetime?: any; resolution?: any; unlinked?: boolean })
content = content.replace(
    /function getProjRangeAndFixed\(skill:\s*\{\s*deployment\?:\s*any;\s*lifetime\?:\s*any;\s*unlinked\?:\s*boolean\s*\}\)/g,
    'function getProjRangeAndFixed(skill: any)'
);

// fix flags.activatableDeployable
content = content.replace(/\.effects\?\.flags\?\.activatableDeployable/g, '.effects?.buffs?.includes("activatable")');
content = content.replace(/\.effects\?\.flags\?\.opaque/g, '.effects?.vision?.blocksVision');

// fix property 'effects' does not exist on CanvasSkill (already replaced mechanics with deployment, but maybe some remain)
content = content.replace(/skill\.effects/g, 'skill.lifetime?.effects');
content = content.replace(/skill\.mechanics/g, 'skill.deployment');
content = content.replace(/pSkill\.skill\.effects/g, 'pSkill.skill.lifetime?.effects');
content = content.replace(/pSkill\.skill\.mechanics/g, 'pSkill.skill.deployment');

// Fix the unmapped `deploymentType` inside page.tsx (not the import)
content = content.replace(/\.deploymentType/g, '.type');

// But undo the import break if any
content = content.replace(/type type,/g, 'DeploymentType,');

// action effects recollectable
content = content.replace(/\.recollectable/g, '?.recollectable');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Replacements 2 done!');
