import { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Avatar } from './Character';
import { PlaceId } from '../content/episodes';

const SKY = '#4C7DFF', PEACH = '#FF8A65', SUN = '#FFC83D', MINT = '#34C79A', NAVY = '#1E2440', WOOD = '#B9835A';

/** Faded circle colour behind each icon. */
export const STOP_TINT: Record<PlaceId, string> = {
  gate: '#DCE8FF', office: '#FFE3D8', cafe: '#FFF0C7', library: '#E3E9FF', lab: '#D3F3E6', amphi: '#E9E4FF',
};

/** Colourful, background-free icon for a map stop. Drawn on a 100×100 grid. */
export default function StopIcon({ place, size }: { place: PlaceId; size: number }) {
  if (place === 'cafe') {
    // Rayan and Lina, the friends you make here, side by side
    const a = size * 0.5;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: size * 0.1 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ borderRadius: a, borderWidth: 3, borderColor: '#fff', marginRight: -a * 0.18, zIndex: 1 }}>
            <Avatar who="rayan" size={a} />
          </View>
          <View style={{ borderRadius: a, borderWidth: 3, borderColor: '#fff', marginTop: a * 0.12 }}>
            <Avatar who="lina" size={a} />
          </View>
        </View>
        <Svg width={size * 0.34} height={size * 0.3} viewBox="0 0 34 30" style={{ position: 'absolute', top: size * 0.04, right: size * 0.02 }}>
          <Path d="M4 2h26a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14l-6 6v-6H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#fff" />
          <Circle cx={11} cy={11} r={2.2} fill={SKY} />
          <Circle cx={17} cy={11} r={2.2} fill={SUN} />
          <Circle cx={23} cy={11} r={2.2} fill={PEACH} />
        </Svg>
      </View>
    );
  }
  const Art = ART[place];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Art />
    </Svg>
  );
}

function University() {
  return (
    <G>
      <Ellipse cx={50} cy={88} rx={38} ry={5} fill="#000" opacity={0.08} />
      <Path d="M50 8V26" stroke={NAVY} strokeWidth={2} />
      <Rect x={51} y={8} width={7} height={10} fill="#1F9D55" />
      <Rect x={58} y={8} width={7} height={10} fill="#fff" />
      {/* crescent and star, the same shapes as the gate scene's flag, scaled to this one */}
      <G transform="translate(58 13) scale(0.85) translate(-189 -34)">
        <Path d="M190.72 31.88A3 3 0 1 0 190.72 36.12A2.4 2.4 0 1 1 190.72 31.88Z" fill="#E03A3A" />
        <Path d="M191.3 32.7L191.61 33.58L192.54 33.6L191.8 34.16L192.06 35.05L191.3 34.52L190.54 35.05L190.81 34.16L190.06 33.6L190.99 33.58Z" fill="#E03A3A" />
      </G>
      <Path d="M12 42L50 22L88 42Z" fill={PEACH} />
      <Rect x={18} y={42} width={64} height={44} fill="#fff" />
      <Rect x={14} y={82} width={72} height={6} rx={2} fill="#E3E8F6" />
      <Rect x={33} y={46} width={34} height={8} rx={2} fill="#E6ECFF" />
      <Path d="M37 50h26" stroke={SKY} strokeWidth={2} strokeLinecap="round" />
      {[24, 33, 61, 70].map((x) => <Rect key={x} x={x} y={58} width={5} height={24} rx={1} fill="#D6DEF7" />)}
      <Path d="M43 82V68a7 7 0 0 1 14 0V82Z" fill={SKY} />
    </G>
  );
}

function Desk() {
  return (
    <G>
      <Ellipse cx={50} cy={90} rx={38} ry={5} fill="#000" opacity={0.08} />
      {/* lamp */}
      <Path d="M22 56V36l10-8" stroke={NAVY} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Path d="M28 24l12 6-6 8z" fill={SUN} />
      <Rect x={16} y={55} width={14} height={4} rx={2} fill={NAVY} />
      {/* laptop */}
      <Rect x={40} y={32} width={40} height={26} rx={3} fill={NAVY} />
      <Rect x={44} y={36} width={32} height={18} rx={1} fill={SKY} />
      <Path d="M48 41h16M48 46h22M48 51h12" stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
      <Rect x={36} y={57} width={48} height={4} rx={2} fill="#9AA3C7" />
      {/* desk */}
      <Rect x={8} y={60} width={84} height={8} rx={3} fill={WOOD} />
      <Rect x={14} y={68} width={6} height={22} fill="#A87249" />
      <Rect x={80} y={68} width={6} height={22} fill="#A87249" />
      <Rect x={58} y={68} width={20} height={14} rx={2} fill="#C99467" />
      <Rect x={64} y={74} width={8} height={2.5} rx={1} fill="#A87249" />
      {/* mug */}
      <Rect x={84} y={50} width={8} height={10} rx={2} fill={MINT} />
    </G>
  );
}

function Books() {
  return (
    <G>
      <Ellipse cx={50} cy={90} rx={36} ry={5} fill="#000" opacity={0.08} />
      {/* stack */}
      <Rect x={16} y={74} width={50} height={12} rx={3} fill={MINT} />
      <Rect x={16} y={78} width={50} height={3} fill="#fff" opacity={0.6} />
      <Rect x={22} y={62} width={44} height={12} rx={3} fill={PEACH} />
      <Rect x={22} y={66} width={44} height={3} fill="#fff" opacity={0.6} />
      <Rect x={18} y={50} width={46} height={12} rx={3} fill={SKY} />
      <Rect x={18} y={54} width={46} height={3} fill="#fff" opacity={0.6} />
      {/* open book */}
      <Path d="M50 22c-8-5-20-6-30-3v26c10-3 22-2 30 3z" fill="#fff" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M50 22c8-5 20-6 30-3v26c-10-3-22-2-30 3z" fill="#fff" stroke={NAVY} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M26 27c6-1 12 0 18 2M26 33c6-1 12 0 18 2M56 29c6-2 12-3 18-2M56 35c6-2 12-3 18-2" stroke={SKY} strokeWidth={2} strokeLinecap="round" />
      {/* pencil */}
      <Path d="M72 86l14-30 5 2-14 30z" fill={SUN} />
      <Path d="M72 86l5 2-4 4z" fill={NAVY} />
    </G>
  );
}

function Deadline() {
  return (
    <G>
      <Ellipse cx={50} cy={90} rx={38} ry={5} fill="#000" opacity={0.08} />
      {/* laptop */}
      <Rect x={10} y={46} width={52} height={34} rx={4} fill={NAVY} />
      <Path d="M18 56h18M18 63h28M18 70h14" stroke={MINT} strokeWidth={3} strokeLinecap="round" />
      <Path d="M40 56h10" stroke={PEACH} strokeWidth={3} strokeLinecap="round" />
      <Rect x={4} y={80} width={64} height={6} rx={3} fill="#9AA3C7" />
      {/* calendar */}
      <Rect x={58} y={14} width={34} height={36} rx={5} fill="#fff" stroke="#E3E8F6" strokeWidth={2} />
      <Rect x={58} y={14} width={34} height={10} rx={5} fill={PEACH} />
      <SvgText x={75} y={44} fontSize={18} fontWeight="bold" fill={NAVY} textAnchor="middle">2</SvgText>
      {/* alarm clock */}
      <Circle cx={80} cy={70} r={13} fill={SUN} />
      <Circle cx={80} cy={70} r={9} fill="#fff" />
      <Path d="M80 64v6l4 3" stroke={NAVY} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <Circle cx={70} cy={58} r={4} fill={PEACH} />
      <Circle cx={90} cy={58} r={4} fill={PEACH} />
    </G>
  );
}

function Board() {
  return (
    <G>
      <Ellipse cx={50} cy={91} rx={34} ry={5} fill="#000" opacity={0.08} />
      <Path d="M32 70L22 90M68 70l10 20M50 70v20" stroke={WOOD} strokeWidth={4} strokeLinecap="round" />
      <Rect x={12} y={14} width={76} height={56} rx={5} fill="#fff" stroke={NAVY} strokeWidth={3} />
      <Rect x={20} y={21} width={24} height={4} rx={2} fill={SKY} />
      {[[24, 50, SKY], [36, 40, MINT], [48, 32, SUN], [60, 44, PEACH], [72, 28, SKY]].map(([x, y, c]) => (
        <Rect key={x as number} x={x as number} y={y as number} width={8} height={62 - (y as number)} rx={1.5} fill={c as string} />
      ))}
      <Path d="M22 62h58" stroke="#D6DEF7" strokeWidth={2} />
      <Path d="M50 14V8" stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
      {/* star */}
      <Path d="M84 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" fill={SUN} />
    </G>
  );
}

const ART: Record<Exclude<PlaceId, 'cafe'>, () => ReactElement> = {
  gate: University, office: Desk, library: Books, lab: Deadline, amphi: Board,
};
