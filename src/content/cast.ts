// The fixed story characters. Colours and features drive the SVG in Character.tsx.
export type CastId = 'benali' | 'haddad' | 'yacine' | 'sara' | 'rayan' | 'lina';

export type CastMember = {
  id: CastId;
  name: string;
  shortName: string;
  role: string;
  personality: string;
  tint: string;
  dot: string;
  skin: string;
  shade: string;
  hair: string;
  brow: string;
  beard: string;
  top: string;
  lapel: string;
  shirt: string;
  hijab: string;
  string: string;
  features: string[];
  voice: { pitch: number; rate: number; index: number };
};

export const CAST: Record<CastId, CastMember> = {
  benali: {
    id: 'benali', name: 'Prof. Karim Benali', shortName: 'Prof. Benali',
    role: 'Academic Writing professor',
    personality: 'calm, precise, kind but strict about deadlines',
    tint: '#E6ECFF', dot: '#2F5BDB',
    skin: '#E8B48F', shade: '#CF9670', hair: '#34343F', brow: '#34343F', beard: '#9A9CAE',
    top: '#2F5BDB', lapel: '#2347B5', shirt: '#FFFFFF', hijab: '#000', string: '#000',
    features: ['cap', 'beard', 'glasses', 'lapel', 'shirt', 'neck'],
    voice: { pitch: 0.8, rate: 0.92, index: 0 },
  },
  haddad: {
    id: 'haddad', name: 'Prof. Nadia Haddad', shortName: 'Prof. Haddad',
    role: 'Project supervisor',
    personality: 'warm, funny, very strict about deadlines',
    tint: '#FFE7DE', dot: '#FF8A65',
    skin: '#D9A27F', shade: '#BD8461', hair: '#2A1D1A', brow: '#2A1D1A', beard: '#000',
    top: '#FF8A65', lapel: '#EF6E48', shirt: '#FFF4E6', hijab: '#000', string: '#000',
    features: ['bob', 'bun', 'fringe', 'glasses', 'lapel', 'shirt', 'earrings', 'neck'],
    voice: { pitch: 1.05, rate: 0.95, index: 1 },
  },
  yacine: {
    id: 'yacine', name: 'Yacine', shortName: 'Yacine',
    role: 'Your classmate',
    personality: 'funny, confident, always late, secretly very good at code',
    tint: '#FFF3CF', dot: '#FFC83D',
    skin: '#C98B63', shade: '#AD704A', hair: '#1E1714', brow: '#1E1714', beard: '#000',
    top: '#FFC83D', lapel: '#000', shirt: '#F0B020', hijab: '#000', string: '#1E2440',
    features: ['curls', 'hood', 'shirt', 'neck'],
    voice: { pitch: 0.92, rate: 1.0, index: 2 },
  },
  sara: {
    id: 'sara', name: 'Sara', shortName: 'Sara',
    role: 'Your project partner',
    personality: 'organised, direct, wants the team to win',
    tint: '#D9F5EB', dot: '#34C79A',
    skin: '#EDC09C', shade: '#D3A27C', hair: '#000', brow: '#5A3A2A', beard: '#000',
    top: '#4C7DFF', lapel: '#000', shirt: '#000', hijab: '#34C79A', string: '#000',
    features: ['hijab'],
    voice: { pitch: 1.15, rate: 0.97, index: 3 },
  },
  rayan: {
    id: 'rayan', name: 'Rayan', shortName: 'Rayan',
    role: 'Your classmate in Academic Writing',
    personality: 'friendly, curious, loves photography and football',
    tint: '#E6E8F2', dot: '#2F3A66',
    skin: '#D9A27F', shade: '#BD8461', hair: '#17110E', brow: '#17110E', beard: '#17110E',
    top: '#2F3A66', lapel: '#000', shirt: '#FFFFFF', hijab: '#000', string: '#000',
    features: ['sidepart', 'stubble', 'strap', 'shirt', 'neck'],
    voice: { pitch: 0.95, rate: 1.0, index: 4 },
  },
  lina: {
    id: 'lina', name: 'Lina', shortName: 'Lina',
    role: 'Your classmate in Academic Writing',
    personality: 'calm, thoughtful, organised, loves mystery novels',
    tint: '#EEE8FB', dot: '#8F78C4',
    skin: '#F3D0B0', shade: '#D9AE8A', hair: '#6B4423', brow: '#6B4423', beard: '#000',
    top: '#B9A3E3', lapel: '#000', shirt: '#8F78C4', hijab: '#000', string: '#000',
    features: ['long', 'sweep', 'glasses', 'earrings', 'shirt', 'neck'],
    voice: { pitch: 1.1, rate: 0.98, index: 5 },
  },
};
