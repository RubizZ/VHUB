// Client-safe agent types, interfaces, and static configurations

export type AgentRole = 'duelist' | 'initiator' | 'controller' | 'sentinel';

export interface ValorantAgent {
  id: string;
  name: string;
  role: AgentRole;
  displayIcon: string;
  killfeedPortrait: string | null;
  fullPortrait: string | null;
  background: string | null;
  roleIcon: string;
  bgColors: string[];
}

export const ROLE_COLORS: Record<AgentRole, string> = {
  duelist: '#FF4655',
  initiator: '#00D4AA',
  controller: '#A855F7',
  sentinel: '#3B82F6',
};
