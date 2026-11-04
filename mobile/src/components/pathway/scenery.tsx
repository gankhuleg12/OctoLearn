import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { AccentKind, HeroKind } from './map-themes';

/**
 * Hand-drawn map scenery. Heroes are larger animated set pieces (one or two per
 * unit); accents are small static props filling the remaining spots.
 * Every piece is drawn on a 100×100 (hero) or 40×40 (accent) grid.
 */

type AnimatedStyle = ComponentProps<typeof Animated.View>['style'];

const INK = '#3D3550';
const SHADOW = 'rgba(30,20,60,0.13)';

/** A 0→1 value that loops forever (back and forth unless `reverse` is false). Still when reduce motion is on. */
function useLoop(duration: number, { delay = 0, reverse = true, linear = false } = {}) {
  const reduceMotion = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const timing = withTiming(1, { duration, easing: linear ? Easing.linear : Easing.inOut(Easing.sin) });
    v.set(withDelay(delay, withRepeat(timing, -1, reverse)));
    return () => cancelAnimation(v);
  }, [v, duration, delay, reverse, linear, reduceMotion]);
  return v;
}

/** One full-size drawing layer; layers stack so parts can move independently. */
function Layer({ style, children }: { style?: AnimatedStyle; children: ReactNode }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {children}
      </Svg>
    </Animated.View>
  );
}

const Shadow = ({ rx = 26, y = 90 }: { rx?: number; y?: number }) => <Ellipse cx={50} cy={y} rx={rx} ry={4} fill={SHADOW} />;

// ---- heroes ------------------------------------------------------------------

function Sheep() {
  const hop = useLoop(450);
  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * hop.get() }, { rotate: `${-3 * hop.get()}deg` }],
  }));
  return (
    <>
      <Layer>
        <Shadow rx={24} />
      </Layer>
      <Layer style={[body, { transformOrigin: '50% 90%' }]}>
        {[34, 45, 57, 66].map((x) => (
          <Rect key={x} x={x} y={66} width={5} height={18} rx={2.5} fill={INK} />
        ))}
        {[
          [38, 60, 13],
          [52, 52, 15],
          [64, 58, 12],
          [50, 66, 14],
          [34, 68, 10],
          [66, 68, 10],
        ].map(([cx, cy, r]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke="#E4E0EE" strokeWidth={1.5} />
        ))}
        <Ellipse cx={74} cy={50} rx={10} ry={12} fill={INK} />
        <Ellipse cx={64} cy={45} rx={6} ry={3} fill={INK} transform="rotate(-25 64 45)" />
        <Circle cx={72} cy={39} r={5} fill="#FFFFFF" />
        <Circle cx={78} cy={40} r={4} fill="#FFFFFF" />
        <Circle cx={77} cy={49} r={2.6} fill="#FFFFFF" />
        <Circle cx={77.6} cy={49.4} r={1.3} fill={INK} />
        <Circle cx={79} cy={56} r={2} fill="#FF9DB5" />
      </Layer>
    </>
  );
}

function Tree() {
  const sway = useLoop(1800);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${-3 + 6 * sway.get()}deg` }] }));
  return (
    <>
      <Layer>
        <Shadow rx={22} y={92} />
      </Layer>
      <Layer style={[style, { transformOrigin: '50% 92%' }]}>
        <Path d="M45 92 L47 56 L53 56 L55 92 Z" fill="#8A5A3B" />
        <Path d="M50 70 L40 60" stroke="#8A5A3B" strokeWidth={4} strokeLinecap="round" />
        <Circle cx={50} cy={56} r={20} fill="#3AA34B" />
        <Circle cx={34} cy={50} r={15} fill="#4CBF5A" />
        <Circle cx={66} cy={50} r={15} fill="#4CBF5A" />
        <Circle cx={50} cy={36} r={21} fill="#4CBF5A" />
        <Circle cx={42} cy={28} r={7} fill="#7FD67A" opacity={0.85} />
        <Circle cx={60} cy={44} r={3.2} fill="#FF5A5A" />
        <Circle cx={38} cy={54} r={3.2} fill="#FF5A5A" />
        <Circle cx={56} cy={60} r={3.2} fill="#FF5A5A" />
      </Layer>
    </>
  );
}

function SmokePuff({ delay }: { delay: number }) {
  const p = useLoop(2400, { delay, reverse: false, linear: true });
  const style = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - p.get()),
    transform: [{ translateY: -26 * p.get() }, { translateX: 8 * p.get() }, { scale: 0.6 + 0.9 * p.get() }],
  }));
  return (
    <Layer style={[style, { transformOrigin: '66% 20%' }]}>
      <Circle cx={66} cy={20} r={5} fill="#F2F0F7" />
    </Layer>
  );
}

function House() {
  return (
    <>
      <SmokePuff delay={0} />
      <SmokePuff delay={800} />
      <SmokePuff delay={1600} />
      <Layer>
        <Shadow rx={32} y={91} />
        <Rect x={61} y={22} width={10} height={20} fill="#B2563F" />
        <Rect x={59} y={20} width={14} height={5} rx={1.5} fill="#8F4231" />
        <Rect x={22} y={48} width={56} height={42} rx={3} fill="#FFE7B8" />
        <Rect x={22} y={84} width={56} height={6} fill="#F2C987" />
        <Path d="M14 54 L50 22 L86 54 Z" fill="#E2574C" stroke="#C2443A" strokeWidth={3} strokeLinejoin="round" />
        <Rect x={44} y={64} width={12} height={26} rx={6} fill="#8A5A3B" />
        <Circle cx={53} cy={78} r={1.4} fill="#FFD34D" />
        {[28, 61].map((x) => (
          <G key={x}>
            <Rect x={x} y={58} width={11} height={11} rx={2} fill="#9EE3FF" stroke="#FFFFFF" strokeWidth={2} />
            <Line x1={x + 5.5} y1={58} x2={x + 5.5} y2={69} stroke="#FFFFFF" strokeWidth={1.5} />
          </G>
        ))}
        <Circle cx={50} cy={40} r={4} fill="#FFD34D" stroke="#C2443A" strokeWidth={1.5} />
      </Layer>
    </>
  );
}

function Windmill() {
  const spin = useLoop(4000, { reverse: false, linear: true });
  const blades = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * spin.get()}deg` }] }));
  return (
    <>
      <Layer>
        <Shadow rx={20} y={92} />
        <Path d="M38 92 L43 44 L57 44 L62 92 Z" fill="#F4E3C3" stroke="#E0C99D" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M46 92 V80 A4 4 0 0 1 54 80 V92 Z" fill="#8A5A3B" />
        <Circle cx={50} cy={62} r={3.5} fill="#9EE3FF" stroke="#FFFFFF" strokeWidth={1.5} />
        <Path d="M39 46 L50 32 L61 46 Z" fill="#C2564A" />
      </Layer>
      <Layer style={[blades, { transformOrigin: '50% 40%' }]}>
        {[0, 90, 180, 270].map((a) => (
          <G key={a} transform={`rotate(${a} 50 40)`}>
            <Rect x={48.5} y={6} width={3} height={34} rx={1.5} fill="#8A5A3B" />
            <Rect x={51.5} y={8} width={10} height={25} rx={1.5} fill="#FFFFFF" stroke="#D9CBB0" strokeWidth={1.2} />
          </G>
        ))}
      </Layer>
      <Layer>
        <Circle cx={50} cy={40} r={4.5} fill="#6B4A33" />
      </Layer>
    </>
  );
}

function Boat() {
  const rock = useLoop(1600);
  const wave = useLoop(2200);
  const hull = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 + 4 * rock.get() }, { rotate: `${-6 + 12 * rock.get()}deg` }],
  }));
  const front = useAnimatedStyle(() => ({ transform: [{ translateX: -4 + 8 * wave.get() }] }));
  return (
    <>
      <Layer>
        <Ellipse cx={50} cy={88} rx={46} ry={10} fill="#7FD0FF" opacity={0.8} />
      </Layer>
      <Layer style={[hull, { transformOrigin: '50% 80%' }]}>
        <Rect x={49} y={22} width={3} height={52} fill="#8A5A3B" />
        <Path d="M53 24 L53 66 L78 66 Z" fill="#FFFFFF" stroke="#E4E0EE" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M48 32 L48 66 L28 66 Z" fill="#FFD34D" />
        <Path d="M52 16 L62 19 L52 22 Z" fill="#4CBF5A" />
        <Path d="M20 70 L80 70 L72 86 L28 86 Z" fill="#E2574C" />
        <Rect x={24} y={74} width={52} height={3.5} fill="#FFFFFF" opacity={0.85} />
      </Layer>
      <Layer style={front}>
        <Path d="M12 90 Q21 85 30 90 T48 90 T66 90 T84 90 Q86 97 50 97 Q12 97 12 90 Z" fill="#3FA9F5" />
      </Layer>
    </>
  );
}

function Gull({ x, y, scale, delay }: { x: number; y: number; scale: number; delay: number }) {
  const flap = useLoop(380, { delay });
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.65 * flap.get() }] }));
  const w = 18 * scale;
  const d = `M${x - w} ${y} Q${x - w / 2} ${y - w * 0.7} ${x} ${y} Q${x + w / 2} ${y - w * 0.7} ${x + w} ${y}`;
  // Outlined white stroke so the bird reads on both light and dark sky.
  return (
    <Layer style={[style, { transformOrigin: `${x}% ${y}%` }]}>
      <Path d={d} stroke="#5A5378" strokeWidth={6.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Layer>
  );
}

function Gulls() {
  const glide = useLoop(2600);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + 10 * glide.get() }, { translateX: -3 + 6 * glide.get() }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Gull x={38} y={40} scale={1} delay={0} />
      <Gull x={70} y={60} scale={0.7} delay={190} />
      <Gull x={58} y={26} scale={0.5} delay={90} />
    </Animated.View>
  );
}

function Flag({ x }: { x: number }) {
  const wave = useLoop(700, { delay: x * 6 });
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - 0.3 * wave.get() }, { skewY: `${-8 * wave.get()}deg` }] }));
  return (
    <Layer style={[style, { transformOrigin: `${x}% 9%` }]}>
      <Path d={`M${x} 5 L${x + 13} 9 L${x} 13 Z`} fill="#FF6B6B" />
    </Layer>
  );
}

function Castle() {
  return (
    <>
      <Layer>
        <Shadow rx={36} y={91} />
        <Rect x={30} y={52} width={40} height={38} fill="#DCD6F5" />
        {[30, 39, 48, 57, 64].map((x) => (
          <Rect key={x} x={x} y={46} width={6} height={7} fill="#DCD6F5" />
        ))}
        <Rect x={16} y={40} width={20} height={50} fill="#C9C2E8" />
        <Rect x={64} y={40} width={20} height={50} fill="#C9C2E8" />
        <Path d="M13 42 L26 16 L39 42 Z" fill="#7C5CFF" />
        <Path d="M61 42 L74 16 L87 42 Z" fill="#7C5CFF" />
        <Path d="M42 90 V76 A8 8 0 0 1 58 76 V90 Z" fill="#4A3F78" />
        <Rect x={23} y={52} width={6} height={9} rx={3} fill="#FFD34D" />
        <Rect x={71} y={52} width={6} height={9} rx={3} fill="#FFD34D" />
        <Rect x={47} y={58} width={6} height={8} rx={3} fill="#FFD34D" />
        <Line x1={26} y1={17} x2={26} y2={4} stroke="#4A3F78" strokeWidth={2} strokeLinecap="round" />
        <Line x1={74} y1={17} x2={74} y2={4} stroke="#4A3F78" strokeWidth={2} strokeLinecap="round" />
      </Layer>
      <Flag x={26} />
      <Flag x={74} />
    </>
  );
}

function Dragon() {
  const bob = useLoop(1400);
  const flap = useLoop(320);
  const body = useAnimatedStyle(() => ({ transform: [{ translateY: -6 + 12 * bob.get() }, { rotate: `${-4 + 8 * bob.get()}deg` }] }));
  const wings = useAnimatedStyle(() => ({ transform: [{ rotate: `${-22 + 34 * flap.get()}deg` }] }));
  return (
    <>
      <Layer>
        <Shadow rx={18} y={94} />
      </Layer>
      <Animated.View style={[StyleSheet.absoluteFill, body]}>
        <Layer style={[wings, { transformOrigin: '48% 48%' }]}>
          <Path d="M48 48 Q40 18 18 16 Q28 28 24 34 Q34 34 36 44 Z" fill="#9B7BFF" />
        </Layer>
        <Layer>
          <Path d="M36 60 Q20 72 12 58 L18 56 Q24 64 34 56 Z" fill="#4CBF5A" />
          <Path d="M10 60 L12 50 L19 57 Z" fill="#FFD34D" />
          <Ellipse cx={48} cy={60} rx={17} ry={13} fill="#4CBF5A" />
          <Ellipse cx={52} cy={64} rx={10} ry={8} fill="#C9F2A8" />
          <Ellipse cx={42} cy={72} rx={4} ry={3} fill="#3AA34B" />
          <Ellipse cx={55} cy={73} rx={4} ry={3} fill="#3AA34B" />
          <Path d="M60 33 L57 22 L65 30 Z" fill="#FFD34D" />
          <Path d="M69 31 L72 21 L74 32 Z" fill="#FFD34D" />
          <Circle cx={67} cy={43} r={13} fill="#4CBF5A" />
          <Ellipse cx={77} cy={48} rx={8} ry={6} fill="#6AD072" />
          <Circle cx={80} cy={46} r={1.2} fill={INK} />
          <Circle cx={67} cy={40} r={4.2} fill="#FFFFFF" />
          <Circle cx={68.4} cy={40.3} r={2.2} fill={INK} />
          <Circle cx={63} cy={50} r={2.4} fill="#FF9DB5" />
        </Layer>
        <Layer style={[wings, { transformOrigin: '50% 50%' }]}>
          <Path d="M50 50 Q46 26 30 24 Q36 34 34 40 Q42 40 44 50 Z" fill="#B49CFF" />
        </Layer>
      </Animated.View>
    </>
  );
}

function CloudShape() {
  return (
    <>
      <Circle cx={34} cy={58} r={14} fill="#FFFFFF" />
      <Circle cx={52} cy={48} r={19} fill="#FFFFFF" />
      <Circle cx={68} cy={58} r={13} fill="#FFFFFF" />
      <Rect x={24} y={58} width={56} height={14} rx={7} fill="#FFFFFF" />
    </>
  );
}

function Cloud({ delay = 0 }: { delay?: number }) {
  const drift = useLoop(4200, { delay });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -10 + 20 * drift.get() }] }));
  return (
    <Layer style={[style, { opacity: 0.9 }]}>
      <CloudShape />
    </Layer>
  );
}

const HEROES: Record<HeroKind, () => ReactNode> = {
  sheep: Sheep,
  tree: Tree,
  house: House,
  windmill: Windmill,
  boat: Boat,
  gulls: Gulls,
  castle: Castle,
  dragon: Dragon,
  cloud: () => <Cloud />,
};

export function Hero({ kind, size }: { kind: HeroKind; size: number }) {
  const Piece = HEROES[kind];
  return (
    <View style={{ width: size, height: size }}>
      <Piece />
    </View>
  );
}

// ---- accents (static) --------------------------------------------------------

function Flower({ petal, center }: { petal: string; center: string }) {
  return (
    <>
      <Path d="M20 38 Q19 30 20 22" stroke="#3AA34B" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Ellipse cx={15} cy={30} rx={5} ry={2.5} fill="#4CBF5A" transform="rotate(30 15 30)" />
      {[0, 72, 144, 216, 288].map((a) => (
        <Circle key={a} cx={20} cy={11} r={5} fill={petal} transform={`rotate(${a} 20 17)`} />
      ))}
      <Circle cx={20} cy={17} r={4.5} fill={center} />
    </>
  );
}

const ACCENTS: Record<AccentKind, ReactNode> = {
  bush: (
    <>
      <Circle cx={12} cy={28} r={9} fill="#3AA34B" />
      <Circle cx={22} cy={24} r={11} fill="#4CBF5A" />
      <Circle cx={30} cy={30} r={7} fill="#3AA34B" />
      <Circle cx={18} cy={20} r={3} fill="#7FD67A" />
      <Circle cx={26} cy={30} r={2} fill="#FF7EB0" />
      <Circle cx={14} cy={30} r={2} fill="#FF7EB0" />
    </>
  ),
  flower: <Flower petal="#FF8FB8" center="#FFD34D" />,
  sunflower: <Flower petal="#FFC83D" center="#8A5A3B" />,
  mushroom: (
    <>
      <Path d="M15 38 L16 24 L24 24 L25 38 Z" fill="#FFF3DE" />
      <Path d="M6 26 Q6 8 20 8 Q34 8 34 26 Z" fill="#FF5A5A" />
      <Circle cx={14} cy={17} r={2.6} fill="#FFFFFF" />
      <Circle cx={24} cy={14} r={2.2} fill="#FFFFFF" />
      <Circle cx={27} cy={21} r={1.8} fill="#FFFFFF" />
    </>
  ),
  pine: (
    <>
      <Rect x={18} y={30} width={4} height={8} fill="#8A5A3B" />
      <Path d="M20 4 L31 18 L9 18 Z" fill="#2E9E58" />
      <Path d="M20 10 L34 31 L6 31 Z" fill="#2E9E58" />
      <Path d="M20 4 L26 12 L20 12 Z" fill="#4CBF5A" />
    </>
  ),
  palm: (
    <>
      <Path d="M21 38 Q23 24 18 12" stroke="#A0703F" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M18 12 Q8 6 2 14 Q10 10 18 13 Z" fill="#3AA34B" />
      <Path d="M18 12 Q28 4 37 12 Q28 9 18 13 Z" fill="#4CBF5A" />
      <Path d="M18 12 Q10 14 8 24 Q13 16 18 13 Z" fill="#4CBF5A" />
      <Path d="M18 12 Q27 14 30 23 Q24 16 18 13 Z" fill="#3AA34B" />
      <Circle cx={19} cy={15} r={2} fill="#8A5A3B" />
    </>
  ),
  rock: (
    <>
      <Path d="M5 36 Q4 24 14 20 Q20 12 28 18 Q36 22 35 36 Z" fill="#A9A6BA" />
      <Path d="M14 22 Q18 17 24 19" stroke="#D5D3E0" strokeWidth={3} strokeLinecap="round" fill="none" />
    </>
  ),
  crystal: (
    <>
      <Path d="M20 4 L28 16 L24 36 L16 36 L12 16 Z" fill="#B49CFF" />
      <Path d="M20 4 L20 36 L16 36 L12 16 Z" fill="#9B7BFF" />
      <Path d="M8 22 L13 28 L12 37 L6 37 L4 28 Z" fill="#FF9DD8" />
    </>
  ),
  sparkle: (
    <>
      <Path d="M20 4 Q22 18 36 20 Q22 22 20 36 Q18 22 4 20 Q18 18 20 4 Z" fill="#FFD34D" />
      <Circle cx={32} cy={8} r={2.5} fill="#FFE68A" />
    </>
  ),
  cloud: (
    <G transform="scale(0.4)">
      <CloudShape />
    </G>
  ),
};

export function Accent({ kind, size }: { kind: AccentKind; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {ACCENTS[kind]}
    </Svg>
  );
}
