const fs = require('fs');
const path = 'src/components/AgentSkillsManager.tsx';
let content = fs.readFileSync(path, 'utf8');

// Container
content = content.replace(
  '<div className="flex flex-col h-full bg-[#0F1923] text-white">',
  '<div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#0F1923", color: "white" }}>'
);
content = content.replace(
  '<div className="flex h-full">',
  '<div style={{ display: "flex", height: "100%" }}>'
);

// Sidebar
content = content.replace(
  '<div className="w-64 border-r border-white/10 bg-[#111] overflow-y-auto hidden md:block">',
  '<div style={{ width: 256, borderRight: "1px solid rgba(255,255,255,0.1)", backgroundColor: "#111", overflowY: "auto" }}>'
);
content = content.replace(
  '<div className="p-4 border-b border-white/10">',
  '<div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>'
);
content = content.replace(
  '<h2 className="font-black text-xl text-[#FF4655]">AGENTES</h2>',
  '<h2 style={{ fontWeight: 900, fontSize: 20, color: "#FF4655", margin: 0 }}>AGENTES</h2>'
);
content = content.replace(
  '<input type="text" placeholder="Buscar agente..." className="w-full mt-4 p-2 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#FF4655]" value={search} onChange={e => setSearch(e.target.value)} />',
  '<input type="text" placeholder="Buscar agente..." style={{ width: "100%", marginTop: 16, padding: 8, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 14, color: "white", outline: "none" }} value={search} onChange={e => setSearch(e.target.value)} />'
);

content = content.replace(
  '<div className="p-2 space-y-1">',
  '<div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>'
);

// Agent List Button
content = content.replace(
  /className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors \$\{selectedAgent\?\.id === agent\.id \? 'bg-\[#FF4655\] text-white' : 'hover:bg-white\/5 text-white\/70'\}`}/g,
  `style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 4, display: "flex", alignItems: "center", gap: 12, backgroundColor: selectedAgent?.id === agent.id ? "#FF4655" : "transparent", color: selectedAgent?.id === agent.id ? "white" : "rgba(255,255,255,0.7)", border: "none", cursor: "pointer" }}`
);

// Agent Image
content = content.replace(
  /<img src=\{agent\.displayIcon\} alt=\{agent\.name\} className="w-8 h-8 rounded-full bg-black\/30" \/>/g,
  `<img src={agent.displayIcon} alt={agent.name} style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.3)", objectFit: "cover" }} />`
);

content = content.replace(
  /<span className="font-bold text-sm tracking-widest">/g,
  `<span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 1 }}>`
);

// Editor Container
content = content.replace(
  '<div className="flex-1 overflow-y-auto">',
  '<div style={{ flex: 1, overflowY: "auto" }}>'
);
content = content.replace(
  '<div className="p-8 max-w-5xl mx-auto">',
  '<div style={{ padding: 32, maxWidth: 1024, margin: "0 auto" }}>'
);
content = content.replace(
  '<div className="flex justify-between items-center mb-6">',
  '<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>'
);
content = content.replace(
  '<h1 className="text-3xl font-black">{selectedAgent.name.toUpperCase()} SKILLS</h1>',
  '<h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>{selectedAgent.name.toUpperCase()} SKILLS</h1>'
);
content = content.replace(
  '<button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded font-bold">Cerrar</button>',
  '<button onClick={onClose} style={{ padding: "8px 16px", backgroundColor: "rgba(255,255,255,0.1)", border: "none", borderRadius: 4, fontWeight: "bold", color: "white", cursor: "pointer" }}>Cerrar</button>'
);

// Skill Tabs
content = content.replace(
  '<div className="flex gap-2 mb-8 bg-black/20 p-2 rounded-xl">',
  '<div style={{ display: "flex", gap: 8, marginBottom: 32, backgroundColor: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 12 }}>'
);
content = content.replace(
  /className={`flex-1 py-3 text-center font-bold tracking-widest rounded-lg transition-colors \$\{editingSkillKey === key \? 'bg-\[#FF4655\] text-white' : 'hover:bg-white\/5 text-white\/50'\}`}/g,
  `style={{ flex: 1, padding: "12px", textAlign: "center", fontWeight: "bold", letterSpacing: 1, borderRadius: 8, backgroundColor: editingSkillKey === key ? "#FF4655" : "transparent", color: editingSkillKey === key ? "white" : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer" }}`
);

// Sub Tabs
content = content.replace(
  '<div className="flex border-b border-white/10 mb-6">',
  '<div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 24 }}>'
);
content = content.replace(
  /className={`px-6 py-3 font-bold border-b-2 transition-colors \$\{activeTab === tab\.id \? 'border-\[#FF4655\] text-white' : 'border-transparent text-white\/50 hover:text-white\/80'\}`}/g,
  `style={{ padding: "12px 24px", fontWeight: "bold", borderBottom: activeTab === tab.id ? "2px solid #FF4655" : "2px solid transparent", color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.5)", background: "transparent", cursor: "pointer" }}`
);

// Grids
content = content.replace(/className="grid grid-cols-2 gap-6"/g, 'style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}');
content = content.replace(/className="grid grid-cols-2 gap-4"/g, 'style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}');
content = content.replace(/className="grid grid-cols-3 gap-4"/g, 'style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}');
content = content.replace(/className="grid grid-cols-2 gap-4 p-4 bg-white\/5 rounded"/g, 'style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4 }}');
content = content.replace(/className="grid grid-cols-2 gap-4 p-4 bg-white\/5 rounded border border-blue-500\/30"/g, 'style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4, border: "1px solid rgba(59,130,246,0.3)" }}');

content = content.replace(/className="space-y-6"/g, 'style={{ display: "flex", flexDirection: "column", gap: 24 }}');
content = content.replace(/className="space-y-2"/g, 'style={{ display: "flex", flexDirection: "column", gap: 8 }}');

content = content.replace(/className="text-xs font-bold text-white\/50 uppercase"/g, 'style={{ fontSize: 12, fontWeight: "bold", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}');
content = content.replace(/className="w-full bg-white\/5 border border-white\/10 rounded p-3 text-white"/g, 'className="input-field" style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: 12, color: "white" }}');

content = content.replace(/className="text-white\/60 text-sm"/g, 'style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}');

content = content.replace(/<div className="p-8 text-center text-white\/50 mt-20">/g, '<div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: 80 }}>');

fs.writeFileSync(path, content, 'utf8');
console.log("Replaced tailwind classes!");
