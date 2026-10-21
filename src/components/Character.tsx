import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { LookSource, getLook } from '../content/avatars';

type Props = {
  who: LookSource;       // a story character's id, or a learner's avatar choices
  size?: number;          // width in dp; height is size * 1.1
  talking?: boolean;      // mouth moves while true
  happy?: boolean;        // bigger smile (results screen)
  style?: ViewStyle;
};

/**
 * One parametric character. Idle: breathes and blinks.
 * Talking: mouth opens and closes while `talking` is true (tie it to the voice).
 */
export default function Character({ who, size = 160, talking = false, happy = false, style }: Props) {
  const c = getLook(who);
  const has = (k: string) => c.features.includes(k);

  // breathing
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  // made once: a new interpolation on every render makes react-native-web re-render in a loop
  const translateY = useMemo(() => breath.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }), [breath]);

  // blinking at a different rhythm per character
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        next();
      }, 2800 + c.blink * 700 + Math.random() * 1500);
    };
    next();
    return () => clearTimeout(t);
  }, [c.blink]);

  // mouth while talking
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!talking) {
      setOpen(false);
      return;
    }
    const i = setInterval(() => setOpen((o) => !o), 150);
    return () => clearInterval(i);
  }, [talking]);

  const eyeRy = blink ? 0.7 : 5.4;

  return (
    <Animated.View style={[{ width: size, height: size * 1.1, transform: [{ translateY }] }, style]}>
      <Svg width={size} height={size * 1.1} viewBox="0 0 200 220">
        {has('hijab') && <Path d="M46 112C40 30 160 30 154 112C158 164 140 190 100 194C60 190 42 164 46 112Z" fill={c.hijab} />}
        {has('long') && <Path d="M50 110C42 28 158 28 150 110L154 172C132 182 68 182 46 172Z" fill={c.hair} />}
        {has('bun') && <Circle cx={100} cy={46} r={20} fill={c.hair} />}
        {has('bob') && <Path d="M58 112C50 34 150 34 142 112C140 130 60 130 58 112Z" fill={c.hair} />}
        <Path d="M24 220C24 170 58 150 100 150C142 150 176 170 176 220Z" fill={c.top} />
        {has('shirt') && <Path d="M84 151L100 180L116 151Z" fill={c.shirt} />}
        {has('lapel') && (
          <G fill={c.lapel}>
            <Path d="M84 151L74 198L100 180Z" />
            <Path d="M116 151L126 198L100 180Z" />
          </G>
        )}
        {has('strap') && (
          <Path d="M66 162L74 220M134 162L126 220" stroke={c.strap ?? '#1E2440'} strokeWidth={8} strokeLinecap="round" fill="none" />
        )}
        {has('hood') && (
          <Path d="M92 160L90 190M108 160L110 190" stroke={c.string} strokeWidth={3} strokeLinecap="round" fill="none" />
        )}
        {has('neck') && <Rect x={88} y={124} width={24} height={34} rx={10} fill={c.shade} />}
        {has('hijab') && <Path d="M54 116C54 170 76 200 100 204C124 200 146 170 146 116Z" fill={c.hijab} />}
        {has('neck') && (
          <G fill={c.skin}>
            <Circle cx={61} cy={106} r={8} />
            <Circle cx={139} cy={106} r={8} />
          </G>
        )}
        <Ellipse cx={100} cy={102} rx={39} ry={44} fill={c.skin} />
        {has('beard') && (
          <G fill={c.beard}>
            <Path d="M62 104C62 150 86 160 100 160C114 160 138 150 138 104C132 126 118 140 100 140C82 140 68 126 62 104Z" />
            <Path d="M86 123Q100 115 114 123Q100 128 86 123Z" />
          </G>
        )}
        {has('stubble') && (
          <Path d="M64 108C66 146 86 156 100 156C114 156 134 146 136 108C130 130 116 142 100 142C84 142 70 130 64 108Z" fill={c.beard} opacity={0.22} />
        )}
        {has('curls') && (
          <G fill={c.hair}>
            <Circle cx={68} cy={80} r={16} />
            <Circle cx={83} cy={64} r={19} />
            <Circle cx={104} cy={59} r={20} />
            <Circle cx={124} cy={65} r={18} />
            <Circle cx={137} cy={81} r={14} />
            <Circle cx={62} cy={95} r={9} />
            <Circle cx={140} cy={96} r={8} />
          </G>
        )}
        {has('cap') && <Path d="M61 98C56 36 144 36 139 98C134 76 118 68 100 68C82 68 66 76 61 98Z" fill={c.hair} />}
        {has('sidepart') && <Path d="M60 100C54 40 144 34 140 96C136 80 128 70 114 64C104 74 82 72 60 100Z" fill={c.hair} />}
        {has('sweep') && <Path d="M60 106C54 34 146 34 140 104C126 76 96 64 60 106Z" fill={c.hair} />}
        {has('buzz') && <Path d="M63 94C61 52 139 52 137 94C128 78 72 78 63 94Z" fill={c.hair} />}
        {has('fringe') && <Path d="M61 104C56 34 144 34 139 104C130 82 112 70 96 72C80 74 66 86 61 104Z" fill={c.hair} />}
        {has('hijab') && <Path d="M56 104C54 38 146 38 144 104C130 74 70 74 56 104Z" fill={c.hijab} />}
        <Path d="M78 91Q86 86 94 90M106 90Q114 86 122 91" stroke={c.brow} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        <Ellipse cx={86} cy={104} rx={4.2} ry={eyeRy} fill="#1E2440" />
        <Ellipse cx={114} cy={104} rx={4.2} ry={eyeRy} fill="#1E2440" />
        {has('glasses') && (
          <G fill="none" stroke="#1E2440" strokeWidth={2.4}>
            <Circle cx={86} cy={104} r={12} />
            <Circle cx={114} cy={104} r={12} />
            <Path d="M98 103H102" />
          </G>
        )}
        <Path d="M100 108Q95 117 101 119" stroke={c.shade} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        <Circle cx={76} cy={119} r={6} fill="#FF8A65" opacity={0.28} />
        <Circle cx={124} cy={119} r={6} fill="#FF8A65" opacity={0.28} />
        {talking && open ? (
          <Ellipse cx={100} cy={131} rx={7} ry={5.5} fill="#8A2F2F" />
        ) : (
          <Path
            d={happy ? 'M86 126Q100 142 114 126' : 'M90 128Q100 136 110 128'}
            stroke="#1E2440"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {has('earrings') && (
          <G fill="#FFC83D">
            <Circle cx={61} cy={120} r={3.5} />
            <Circle cx={139} cy={120} r={3.5} />
          </G>
        )}
      </Svg>
    </Animated.View>
  );
}

/** Small round avatar (head only), for chips and chat. */
export function Avatar({ who, size = 36 }: { who: LookSource; size?: number }) {
  const c = getLook(who);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.tint, overflow: 'hidden', alignItems: 'center' }}>
      <View style={{ marginTop: size * 0.05 }}>
        <Character who={who} size={size * 1.15} />
      </View>
    </View>
  );
}
