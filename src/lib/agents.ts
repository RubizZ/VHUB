// Agents data with real UUIDs and asset URLs from valorant-api.com

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

export interface ValorantAgent {
  id: string;
  name: string;
  role: AgentRole;
  displayIcon: string;
  killfeedPortrait: string;
  fullPortrait: string;
  background: string;
  roleIcon: string;
  bgColors: [string, string];
}

const ROLE_ICONS = {
  duelist: 'https://media.valorant-api.com/agents/roles/dbe8757e-9e92-4ed4-b39f-9dfc589691d4/displayicon.png',
  initiator: 'https://media.valorant-api.com/agents/roles/1b47567f-8f7b-444b-aae3-b0c634622d10/displayicon.png',
  controller: 'https://media.valorant-api.com/agents/roles/4ee40330-ecdd-4f2f-98a8-eb1243428373/displayicon.png',
  sentinel: 'https://media.valorant-api.com/agents/roles/5fc02f99-4091-4486-a531-98459a3e95e9/displayicon.png',
};

function agent(id: string, name: string, role: AgentRole, bgColors: [string, string]): ValorantAgent {
  return {
    id, name, role,
    displayIcon: `https://media.valorant-api.com/agents/${id}/displayicon.png`,
    killfeedPortrait: `https://media.valorant-api.com/agents/${id}/killfeedportrait.png`,
    fullPortrait: `https://media.valorant-api.com/agents/${id}/fullportrait.png`,
    background: `https://media.valorant-api.com/agents/${id}/background.png`,
    roleIcon: ROLE_ICONS[role],
    bgColors,
  };
}

export const AGENTS: ValorantAgent[] = [
  // Duelists
  agent('add6443a-41bd-e414-f6ad-e58d267f4e95', 'Jett', 'duelist', ['#25607a', '#0f1923']),
  agent('f94c3b30-42be-e959-889c-5aa313dba261', 'Raze', 'duelist', ['#742e1e', '#2c5942']),
  agent('a3bfb853-43b2-7238-a4f1-ad90e9e46bcc', 'Reyna', 'duelist', ['#662d62', '#2f2664']),
  agent('eb93336a-449b-9c1b-0a54-a891f7921d69', 'Phoenix', 'duelist', ['#74321c', '#262423']),
  agent('7f94d92c-4234-0a36-9646-3a87eb8b5c89', 'Yoru', 'duelist', ['#222b67', '#261e4f']),
  agent('bb2a4828-46eb-8cd1-e765-15848195d751', 'Neon', 'duelist', ['#413476', '#38328e']),
  agent('0e38b510-41a8-5780-5e8f-568b2a4f2d6c', 'Iso', 'duelist', ['#30336e', '#20155d']),
  agent('df1cb487-4902-002e-5c17-d28e83e78588', 'Waylay', 'duelist', ['#482e61', '#0f1923']),

  // Initiators
  agent('320b2a48-4d9b-a075-30f1-1f93a9b638fa', 'Sova', 'initiator', ['#355285', '#101c47']),
  agent('5f8d3a7f-467b-97f3-062c-13acf203c006', 'Breach', 'initiator', ['#81331a', '#523a23']),
  agent('6f2a04ca-43e0-be17-7f36-b3908627744d', 'Skye', 'initiator', ['#436a51', '#4f1413']),
  agent('601dbbe7-43ce-be57-2a40-4abd24953621', 'KAY/O', 'initiator', ['#1c2a69', '#1a1e4b']),
  agent('dade69b4-4f5a-8528-247b-219e5a1facd6', 'Fade', 'initiator', ['#1d2846', '#18344c']),
  agent('e370fa57-4757-3604-3648-499e1f642d3f', 'Gekko', 'initiator', ['#371c5c', '#3a2656']),
  agent('b444168c-4e35-8076-db47-ef9bf368f384', 'Tejo', 'initiator', ['#80451b', '#0f1923']),

  // Controllers
  agent('9f0d8ba9-4140-b941-57d3-a7ad57c6b417', 'Brimstone', 'controller', ['#363c4f', '#211d21']),
  agent('8e253930-4c05-31dd-1b6c-968525494517', 'Omen', 'controller', ['#433178', '#344673']),
  agent('707eab51-4836-f488-046a-cda6bf494859', 'Viper', 'controller', ['#1a5f46', '#2c4f5e']),
  agent('41fb69c1-4189-7b37-f117-bcaf1e96f1bf', 'Astra', 'controller', ['#26146c', '#5210c6']),
  agent('95b78ed7-4637-86d9-7e41-71ba8c293152', 'Harbor', 'controller', ['#275146', '#11434e']),
  agent('1dbf2edd-4729-0984-3115-daa5eed44993', 'Clove', 'controller', ['#4b1d80', '#c347c7']),
  agent('7c8a4701-4de6-9355-b254-e09bc2a34b72', 'Miks', 'controller', ['#462b75', '#344673']),

  // Sentinels
  agent('117ed9e3-49f3-6512-3ccf-0cada7e3823b', 'Cypher', 'sentinel', ['#2f5078', '#3f3f6c']),
  agent('569fdd95-4d10-43ab-ca70-79becc718b46', 'Sage', 'sentinel', ['#1f5148', '#102d23']),
  agent('1e58de9c-4950-5125-93e9-a0aee9f98746', 'Killjoy', 'sentinel', ['#522162', '#413950']),
  agent('22697a3d-45bf-8dd7-4fec-84a9e28c69d7', 'Chamber', 'sentinel', ['#20435b', '#372d2b']),
  agent('cc8b64c8-4b25-4ff9-6e7f-37b4da43d235', 'Deadlock', 'sentinel', ['#425495', '#221c3d']),
  agent('efba5359-4016-a1e5-7626-b1ae76895940', 'Vyse', 'sentinel', ['#492280', '#0f1923']),
  agent('92eeef5d-43b5-1d4a-8d03-b3927a09034b', 'Veto', 'sentinel', ['#1a5d65', '#0f1923']),
];

/** Find agent by UUID */
export function findAgentById(id: string): ValorantAgent | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** Find agent by name (case-insensitive) */
export function findAgentByName(name: string): ValorantAgent | undefined {
  return AGENTS.find((a) => a.name.toLowerCase() === name.toLowerCase());
}

/** Get agents by role */
export function getAgentsByRole(role: AgentRole): ValorantAgent[] {
  return AGENTS.filter((a) => a.role === role);
}

export const ROLE_COLORS: Record<AgentRole, string> = {
  duelist: '#FF4655',
  initiator: '#00D4AA',
  controller: '#A855F7',
  sentinel: '#3B82F6',
};
