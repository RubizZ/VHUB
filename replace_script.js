const fs = require('fs');
let code = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

// Replace ['self_instant'] with ['dash_teleport'] in isProj definitions and other movement logic
code = code.replace(/\[\s*"self_instant"\s*\]\.includes/g, '["dash_teleport"].includes');

// Restore ['self_instant'] where BOTH should be checked (e.g. initial target setting)
// Line 4247 block: [..., "equip_weapon", "dash_teleport"] -> [..., "equip_weapon", "dash_teleport", "self_instant"]
code = code.replace(/"equip_weapon",\s*"dash_teleport"/g, '"equip_weapon",\n                        "dash_teleport",\n                        "self_instant"');

// Line 4390 block: !["dash_teleport"].includes -> !["dash_teleport", "self_instant"].includes
code = code.replace(/!\["dash_teleport"\]\.includes\(getDeploymentType\(skill\)\)/g, '!["dash_teleport", "self_instant"].includes(getDeploymentType(skill))');

// Update preview block
code = code.replace(/\["self_instant", "map_target_aoe", "two_point_barrier"\]\.includes/g, '["dash_teleport", "map_target_aoe", "two_point_barrier"].includes');

// Update range check block
code = code.replace(/\["map_target_aoe", "two_point_barrier", "self_instant"\]\.includes/g, '["map_target_aoe", "two_point_barrier", "dash_teleport"].includes');

fs.writeFileSync('src/app/strategies/page.tsx', code);
