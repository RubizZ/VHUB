export interface ValorantMap {
  id: string;
  name: string;
  image: string;
  minimap: string;
  competitive: boolean;
}

export interface ValorantAgent {
  id: string;
  name: string;
  role: 'duelist' | 'initiator' | 'controller' | 'sentinel';
  color: string;
  icon: string;
}

export const MAPS: ValorantMap[] = [
  { id: 'ascent', name: 'Ascent', image: '/maps/ascent.svg', minimap: '/maps/ascent.svg', competitive: true },
  { id: 'breeze', name: 'Breeze', image: '/maps/breeze.svg', minimap: '/maps/breeze.svg', competitive: true },
  { id: 'fracture', name: 'Fracture', image: '/maps/fracture.svg', minimap: '/maps/fracture.svg', competitive: true },
  { id: 'haven', name: 'Haven', image: '/maps/haven.svg', minimap: '/maps/haven.svg', competitive: true },
  { id: 'lotus', name: 'Lotus', image: '/maps/lotus.svg', minimap: '/maps/lotus.svg', competitive: true },
  { id: 'pearl', name: 'Pearl', image: '/maps/pearl.svg', minimap: '/maps/pearl.svg', competitive: true },
  { id: 'split', name: 'Split', image: '/maps/split.svg', minimap: '/maps/split.svg', competitive: true },
  { id: 'bind', name: 'Bind', image: '/maps/bind.svg', minimap: '/maps/bind.svg', competitive: false },
  { id: 'icebox', name: 'Icebox', image: '/maps/icebox.svg', minimap: '/maps/icebox.svg', competitive: false },
  { id: 'sunset', name: 'Sunset', image: '/maps/sunset.svg', minimap: '/maps/sunset.svg', competitive: false },
  { id: 'abyss', name: 'Abyss', image: '/maps/abyss.svg', minimap: '/maps/abyss.svg', competitive: false },
];

export const AGENTS: ValorantAgent[] = [
  // Duelists
  { id: 'jett', name: 'Jett', role: 'duelist', color: '#89CFF0', icon: '⚡' },
  { id: 'phoenix', name: 'Phoenix', role: 'duelist', color: '#FF6B35', icon: '🔥' },
  { id: 'raze', name: 'Raze', role: 'duelist', color: '#FF8C42', icon: '💥' },
  { id: 'reyna', name: 'Reyna', role: 'duelist', color: '#9B59B6', icon: '👁️' },
  { id: 'yoru', name: 'Yoru', role: 'duelist', color: '#1A237E', icon: '🌀' },
  { id: 'neon', name: 'Neon', role: 'duelist', color: '#00BCD4', icon: '⚡' },
  { id: 'iso', name: 'Iso', role: 'duelist', color: '#7C4DFF', icon: '🛡️' },
  { id: 'clove', name: 'Clove', role: 'duelist', color: '#E040FB', icon: '🦋' },
  { id: 'waylay', name: 'Waylay', role: 'duelist', color: '#4DB6AC', icon: '🎯' },

  // Initiators
  { id: 'sova', name: 'Sova', role: 'initiator', color: '#2196F3', icon: '🏹' },
  { id: 'breach', name: 'Breach', role: 'initiator', color: '#FF5722', icon: '🤜' },
  { id: 'skye', name: 'Skye', role: 'initiator', color: '#4CAF50', icon: '🌿' },
  { id: 'kayo', name: 'KAY/O', role: 'initiator', color: '#607D8B', icon: '🤖' },
  { id: 'fade', name: 'Fade', role: 'initiator', color: '#37474F', icon: '😱' },
  { id: 'gekko', name: 'Gekko', role: 'initiator', color: '#76FF03', icon: '🦎' },
  { id: 'tejo', name: 'Tejo', role: 'initiator', color: '#8D6E63', icon: '🎯' },

  // Controllers
  { id: 'brimstone', name: 'Brimstone', role: 'controller', color: '#FF9800', icon: '☁️' },
  { id: 'viper', name: 'Viper', role: 'controller', color: '#00C853', icon: '☠️' },
  { id: 'omen', name: 'Omen', role: 'controller', color: '#311B92', icon: '👻' },
  { id: 'astra', name: 'Astra', role: 'controller', color: '#7B1FA2', icon: '⭐' },
  { id: 'harbor', name: 'Harbor', role: 'controller', color: '#00897B', icon: '🌊' },

  // Sentinels
  { id: 'sage', name: 'Sage', role: 'sentinel', color: '#00E5FF', icon: '💎' },
  { id: 'cypher', name: 'Cypher', role: 'sentinel', color: '#795548', icon: '📷' },
  { id: 'killjoy', name: 'Killjoy', role: 'sentinel', color: '#FFC107', icon: '🔧' },
  { id: 'chamber', name: 'Chamber', role: 'sentinel', color: '#D4AF37', icon: '🎩' },
  { id: 'deadlock', name: 'Deadlock', role: 'sentinel', color: '#546E7A', icon: '🔒' },
  { id: 'vyse', name: 'Vyse', role: 'sentinel', color: '#CE93D8', icon: '🔮' },
];

export const ROLE_COLORS: Record<string, string> = {
  duelist: '#FF4655',
  initiator: '#00D4AA',
  controller: '#A855F7',
  sentinel: '#3B82F6',
  flex: '#F59E0B',
};

export const ROLE_LABELS: Record<string, string> = {
  duelist: 'Duelista',
  initiator: 'Iniciador',
  controller: 'Controlador',
  sentinel: 'Centinela',
  flex: 'Flex',
};
