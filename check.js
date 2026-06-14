const fs = require('fs');
let s = fs.readFileSync('src/components/AgentSkillsManager.tsx', 'utf8');

const str1 = '                  <div style={{ display: "flex", gap: 12, marginBottom: 24, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 16 }}>';
console.log("form_tabs_start:", s.indexOf(str1));

const str2 = '                  <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end" }}>';
console.log("form_tabs_end:", s.indexOf(str2));
