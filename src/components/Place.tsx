import { ReactElement, useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { PlaceId } from '../content/episodes';

type Props = { place: PlaceId; width: number; height: number; still?: boolean };

export const PLACE_TINT: Record<PlaceId, string> = {
  gate: '#CFE3FF', office: '#FFE7DE', cafe: '#FFF3CF', library: '#EEF2FF', lab: '#D9F5EB', amphi: '#ECE8FF',
};

// Books on a shelf: [x, y, w, h, colour]
const SKY = '#4C7DFF', PEACH = '#FF8A65', SUN = '#FFC83D', MINT = '#34C79A', NAVY = '#1E2440';
const LEFT_BOOKS: [number, number, number, number, string][] = [
  [30, 48, 9, 30, SKY], [40, 52, 10, 26, PEACH], [51, 46, 9, 32, SUN], [61, 50, 11, 28, MINT], [73, 54, 9, 24, NAVY], [83, 48, 10, 30, SKY],
  [30, 90, 10, 28, MINT], [41, 86, 9, 32, NAVY], [51, 92, 11, 26, SUN], [63, 88, 9, 30, PEACH], [73, 94, 10, 24, SKY], [84, 90, 9, 28, MINT],
  [30, 130, 9, 28, PEACH], [40, 126, 10, 32, SKY], [51, 132, 9, 26, MINT], [61, 128, 11, 30, SUN], [73, 134, 9, 24, NAVY], [83, 130, 10, 28, PEACH],
];
const RIGHT_COLOURS = [SUN, MINT, SKY, PEACH, MINT, NAVY, PEACH, SKY, MINT, SUN, NAVY, SKY, MINT, SUN, PEACH, SKY, MINT, SUN];

/** Illustrated background for a level. `still` turns off the ambient glow (used for small map tiles). */
export default function Place({ place, width, height, still }: Props) {
  const glow = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.7, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.35, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow, still]);

  const Art = ART[place];
  return (
    <View style={{ width, height, backgroundColor: PLACE_TINT[place], overflow: 'hidden' }}>
      <Svg width={width} height={height} viewBox="0 0 360 210" preserveAspectRatio="xMidYMax slice">
        <Art />
      </Svg>
      {place === 'library' && !still && (
        // soft light from the window
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', left: width * 0.38, width: width * 0.24, bottom: 0, height: height * 0.3,
            backgroundColor: '#FFFFFF', opacity: glow, borderTopLeftRadius: 8, borderTopRightRadius: 8,
          }}
        />
      )}
    </View>
  );
}

function Palm({ x, flip }: { x: number; flip?: boolean }) {
  const d = flip ? -1 : 1;
  return (
    <G>
      <Path d={`M${x} 180 Q${x + 6 * d} 130 ${x} 92`} stroke="#B07A4E" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d={`M${x} 92 Q${x - 30} 80 ${x - 44} 100 Q${x - 22} 88 ${x} 96Z`} fill={MINT} />
      <Path d={`M${x} 92 Q${x + 30} 80 ${x + 44} 100 Q${x + 22} 88 ${x} 96Z`} fill={MINT} />
      <Path d={`M${x} 92 Q${x - 18} 66 ${x - 34} 70 Q${x - 14} 76 ${x} 94Z`} fill="#23A27C" />
      <Path d={`M${x} 92 Q${x + 18} 66 ${x + 34} 70 Q${x + 14} 76 ${x} 94Z`} fill="#23A27C" />
    </G>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={26 * s} ry={11 * s} fill="#FFFFFF" />
      <Circle cx={x + 10 * s} cy={y - 8 * s} r={12 * s} fill="#FFFFFF" />
    </G>
  );
}

function Gate() {
  return (
    <G>
      <Circle cx={312} cy={46} r={26} fill="#FFE59A" />
      <Circle cx={312} cy={46} r={17} fill={SUN} />
      <Cloud x={60} y={44} />
      <Cloud x={230} y={30} s={0.8} />
      <Rect y={170} width={360} height={40} fill="#BFE6D6" />
      <Path d="M160 210L170 170H190L200 210Z" fill="#F4DFC0" />
      {/* building */}
      <Path d="M100 92L180 54L260 92Z" fill={PEACH} />
      <Rect x={112} y={92} width={136} height={80} fill="#FFFFFF" />
      <Rect x={140} y={98} width={80} height={14} rx={3} fill="#E6ECFF" />
      <SvgText x={180} y={109} fontSize={9} fontWeight="bold" fill="#2F5BDB" textAnchor="middle" letterSpacing={1.5}>UNIVERSITÉ</SvgText>
      {[124, 140, 206, 222].map((x) => <Rect key={x} x={x} y={120} width={9} height={50} fill="#E6ECFF" />)}
      <Path d="M166 172V136A14 14 0 0 1 194 136V172Z" fill={SKY} />
      {/* Algerian flag */}
      <Path d="M180 54V28" stroke={NAVY} strokeWidth={2} />
      <Rect x={181} y={28} width={8} height={12} fill="#1F9D55" />
      <Rect x={189} y={28} width={8} height={12} fill="#FFFFFF" />
      {/* red crescent (opening to the right) and five-pointed star, centred on the stripe line */}
      <Path d="M190.72 31.88A3 3 0 1 0 190.72 36.12A2.4 2.4 0 1 1 190.72 31.88Z" fill="#E03A3A" />
      <Path d="M191.3 32.7L191.61 33.58L192.54 33.6L191.8 34.16L192.06 35.05L191.3 34.52L190.54 35.05L190.81 34.16L190.06 33.6L190.99 33.58Z" fill="#E03A3A" />
      <Palm x={64} />
      <Palm x={300} flip />
      <Ellipse cx={96} cy={174} rx={16} ry={7} fill={MINT} />
      <Ellipse cx={268} cy={174} rx={16} ry={7} fill={MINT} />
    </G>
  );
}

function Office() {
  return (
    <G>
      <Rect y={172} width={360} height={38} fill="#F6CDBE" />
      {/* window */}
      <Rect x={30} y={34} width={92} height={78} rx={6} fill="#FFFFFF" />
      <Rect x={36} y={40} width={80} height={66} fill="#CFE3FF" />
      <Path d="M76 40V106M36 73H116" stroke="#FFFFFF" strokeWidth={4} />
      <Cloud x={62} y={60} s={0.5} />
      {/* clock */}
      <Circle cx={178} cy={56} r={18} fill="#FFFFFF" stroke={NAVY} strokeWidth={3} />
      <Path d="M178 44V56L187 61" stroke={NAVY} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {/* note */}
      <Rect x={140} y={40} width={22} height={28} rx={2} fill="#FFFFFF" />
      <Path d="M145 49H157M145 55H157M145 61H153" stroke="#9AA3C7" strokeWidth={2} />
      {/* shelf */}
      <Rect x={262} y={30} width={70} height={142} rx={4} fill="#E4BF94" />
      {[70, 112, 150].map((y) => <Rect key={y} x={262} y={y} width={70} height={4} fill="#D7AE80" />)}
      {[[270, SKY], [280, SUN], [290, MINT], [300, PEACH], [312, NAVY]].map(([x, c], i) => (
        <Rect key={i} x={x as number} y={44 + (i % 2) * 4} width={9} height={26 - (i % 2) * 4} fill={c as string} />
      ))}
      {[[272, PEACH], [283, SKY], [296, SUN], [308, MINT]].map(([x, c], i) => (
        <Rect key={i} x={x as number} y={86 + (i % 2) * 5} width={10} height={26 - (i % 2) * 5} fill={c as string} />
      ))}
      {/* desk + laptop */}
      <Rect x={120} y={120} width={150} height={10} rx={3} fill="#B9835A" />
      <Rect x={130} y={130} width={50} height={42} fill="#C99467" />
      <Rect x={136} y={138} width={38} height={4} rx={2} fill="#A87249" />
      <Rect x={136} y={152} width={38} height={4} rx={2} fill="#A87249" />
      <Rect x={252} y={130} width={8} height={42} fill="#A87249" />
      <Rect x={196} y={90} width={46} height={30} rx={3} fill={NAVY} />
      <Rect x={200} y={94} width={38} height={22} fill={SKY} />
      <Rect x={190} y={118} width={58} height={4} rx={2} fill="#9AA3C7" />
      {/* plant */}
      <Path d="M48 172H72L68 148H52Z" fill={PEACH} />
      <Path d="M60 148Q48 128 40 132Q50 138 58 148M60 148Q74 124 82 130Q70 136 62 148M60 148V126" stroke={MINT} strokeWidth={5} fill="none" strokeLinecap="round" />
    </G>
  );
}

function Cafe() {
  return (
    <G>
      <Rect y={172} width={360} height={38} fill="#F5DCA6" />
      {/* pendant lamps */}
      {[[62, PEACH], [112, SKY], [162, MINT]].map(([x, c]) => (
        <G key={x as number}>
          <Path d={`M${x} 0V34`} stroke={NAVY} strokeWidth={2} />
          <Path d={`M${(x as number) - 12} 46L${(x as number) - 7} 34H${(x as number) + 7}L${(x as number) + 12} 46Z`} fill={c as string} />
        </G>
      ))}
      {/* menu board */}
      <Rect x={214} y={30} width={118} height={66} rx={8} fill={NAVY} />
      <Path d="M228 48H300M228 62H312M228 76H290" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      <Circle cx={316} cy={80} r={7} fill="none" stroke={SUN} strokeWidth={3} />
      {/* counter */}
      <Rect x={20} y={112} width={176} height={8} rx={2} fill="#FFFFFF" />
      <Rect x={26} y={120} width={164} height={52} fill={PEACH} />
      {[52, 82, 112, 142, 168].map((x) => <Rect key={x} x={x} y={120} width={4} height={52} fill="#FFA88A" />)}
      <Rect x={40} y={88} width={36} height={24} rx={4} fill="#9AA3C7" />
      <Rect x={48} y={94} width={20} height={6} rx={2} fill={NAVY} />
      <Rect x={96} y={98} width={12} height={14} rx={2} fill="#FFFFFF" />
      <Rect x={114} y={100} width={12} height={12} rx={2} fill={SKY} />
      <Path d="M100 92Q96 84 102 78M108 92Q104 84 110 78" stroke="#FFFFFF" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* table + chairs */}
      <Ellipse cx={270} cy={140} rx={30} ry={6} fill="#FFFFFF" />
      <Rect x={267} y={140} width={6} height={30} fill="#9AA3C7" />
      <Ellipse cx={270} cy={172} rx={16} ry={3} fill="#9AA3C7" />
      <Path d="M228 128V172M226 150H244M312 128V172M296 150H314" stroke={SKY} strokeWidth={5} strokeLinecap="round" />
      <Rect x={258} y={130} width={10} height={8} rx={2} fill={MINT} />
      <Ellipse cx={282} cy={134} rx={8} ry={3.5} fill={SUN} />
    </G>
  );
}

function Library() {
  return (
    <G>
      <Rect y={172} width={360} height={38} fill="#DCE3FB" />
      <Path d="M140 150V70A40 40 0 0 1 220 70V150Z" fill="#FFFFFF" />
      <Path d="M146 150V72A34 34 0 0 1 214 72V150Z" fill="#CFE3FF" />
      <Path d="M180 38V150M146 100H214" stroke="#FFFFFF" strokeWidth={4} />
      {[20, 240].map((x0, s) => (
        <G key={x0}>
          <Rect x={x0} y={36} width={100} height={136} rx={6} fill="#F1D3AE" />
          <Rect x={x0 + 6} y={42} width={88} height={124} fill="#E4BF94" />
          {[78, 118, 158].map((y) => (
            <Rect key={y} x={x0 + 6} y={y} width={88} height={4} fill="#D7AE80" />
          ))}
          {LEFT_BOOKS.map(([x, y, w, h, col], i) => (
            <Rect key={i} x={x + (x0 - 20)} y={y} width={w} height={h} fill={s === 0 ? col : RIGHT_COLOURS[i]} />
          ))}
        </G>
      ))}
      <Rect x={150} y={150} width={60} height={6} rx={2} fill="#B9835A" />
      <Rect x={156} y={156} width={5} height={18} fill="#A87249" />
      <Rect x={199} y={156} width={5} height={18} fill="#A87249" />
      <Rect x={160} y={142} width={18} height={8} rx={2} fill={PEACH} />
      <Path d="M192 150V138M186 138H198L195 132H189Z" stroke={NAVY} strokeWidth={2} fill={MINT} />
      <Path d="M318 196L326 40M334 196L342 40M320 172H336M322 146H338M325 120H341M328 94H343" stroke="#B8875A" strokeWidth={3.5} strokeLinecap="round" />
    </G>
  );
}

function Lab() {
  return (
    <G>
      <Rect y={176} width={360} height={34} fill="#BFE6D6" />
      {/* whiteboard */}
      <Rect x={34} y={28} width={170} height={100} rx={8} fill="#FFFFFF" stroke="#9AA3C7" strokeWidth={4} />
      <SvgText x={48} y={50} fontSize={12} fontWeight="bold" fill="#E5533D">DEADLINE: FRIDAY</SvgText>
      <Path d="M48 66H120M48 82H108M48 98H128" stroke={SKY} strokeWidth={4} strokeLinecap="round" />
      <Rect x={140} y={62} width={20} height={20} rx={2} fill={SUN} />
      <Rect x={164} y={66} width={20} height={20} rx={2} fill={PEACH} />
      <Rect x={146} y={88} width={20} height={20} rx={2} fill="#AFC3FF" />
      {/* calendar */}
      <Rect x={226} y={40} width={50} height={52} rx={6} fill="#FFFFFF" />
      <Rect x={226} y={40} width={50} height={13} rx={6} fill={PEACH} />
      <SvgText x={251} y={84} fontSize={28} fontWeight="bold" fill={NAVY} textAnchor="middle">2</SvgText>
      {/* window */}
      <Rect x={296} y={36} width={46} height={66} rx={4} fill="#FFFFFF" />
      <Rect x={301} y={41} width={16} height={56} fill="#CFE3FF" />
      <Rect x={321} y={41} width={16} height={56} fill="#CFE3FF" />
      {/* desk + laptops */}
      <Rect x={30} y={144} width={300} height={8} rx={3} fill="#FFFFFF" />
      <Rect x={52} y={152} width={6} height={26} fill="#9AA3C7" />
      <Rect x={302} y={152} width={6} height={26} fill="#9AA3C7" />
      {[70, 196].map((x, i) => (
        <G key={x}>
          <Rect x={x} y={112} width={70} height={32} rx={4} fill={NAVY} />
          <Path d={`M${x + 8} 122H${x + 40}M${x + 8} 130H${x + 52}M${x + 8} 138H${x + 32}`} stroke={i ? PEACH : MINT} strokeWidth={3} strokeLinecap="round" />
          <Rect x={x - 6} y={142} width={82} height={4} rx={2} fill="#9AA3C7" />
        </G>
      ))}
      <Rect x={158} y={128} width={12} height={16} rx={3} fill={SKY} />
    </G>
  );
}

function Amphi() {
  return (
    <G>
      <Rect y={150} width={360} height={60} fill="#D9D2FB" />
      {/* screen */}
      <Rect x={110} y={20} width={140} height={90} rx={6} fill="#FFFFFF" stroke={NAVY} strokeWidth={4} />
      <Rect x={124} y={34} width={40} height={6} rx={3} fill={SKY} />
      {[[132, 70, SKY], [150, 56, MINT], [168, 46, SUN], [186, 62, PEACH], [204, 40, SKY]].map(([x, y, c]) => (
        <Rect key={x as number} x={x as number} y={y as number} width={12} height={100 - (y as number)} fill={c as string} />
      ))}
      <Path d="M180 110V124" stroke={NAVY} strokeWidth={3} />
      {/* podium */}
      <Path d="M262 112H296L292 150H266Z" fill="#B9835A" />
      <Rect x={258} y={106} width={42} height={8} rx={3} fill="#A87249" />
      {/* audience */}
      <Rect x={10} y={168} width={340} height={10} rx={4} fill="#F5DCA6" />
      {[[30, PEACH, NAVY], [70, MINT, '#2A1D1A'], [110, SKY, '#1E1714'], [150, SUN, '#34343F'], [190, PEACH, '#2A1D1A'], [230, MINT, NAVY], [270, SKY, '#1E1714'], [310, SUN, '#2A1D1A']].map(([x, top, hair], i) => (
        <G key={i}>
          <Path d={`M${(x as number) - 13} 172A13 13 0 0 1 ${(x as number) + 13} 172Z`} fill={top as string} />
          <Circle cx={x as number} cy={150} r={9} fill={i % 3 === 0 ? '#D9A27F' : i % 3 === 1 ? '#C98B63' : '#EDC09C'} />
          <Path d={`M${(x as number) - 9} 148A9 9 0 0 1 ${(x as number) + 9} 148Z`} fill={i === 2 ? MINT : (hair as string)} />
        </G>
      ))}
    </G>
  );
}

const ART: Record<PlaceId, () => ReactElement> = {
  gate: Gate, office: Office, cafe: Cafe, library: Library, lab: Lab, amphi: Amphi,
};
