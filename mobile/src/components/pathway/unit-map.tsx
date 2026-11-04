import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { NodeState, Unit } from '@/api/types';
import { Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { FOG, landTheme } from './map-themes';
import { PathNode } from './path-node';
import { Accent, Hero } from './scenery';
import { unitColor } from './unit-header';

/** Horizontal offsets that make the trail snake left and right. */
const ZIGZAG = [0, 52, 80, 52, 0, -52, -80, -52];
/** Fixed row height so node centres (and the trail through them) are known without measuring. */
const ROW_H = 150;
// Room for the "ЭХЛЭХ" bubble below the unit banner that overlaps the map's top edge.
const PAD_TOP = 84;
const PAD_BOTTOM = 8;
/** Node face centre inside a row: row padding + node wrap padding + half the face. */
const centerInRow = (size: number) => 12 + size / 2;
const LESSON_SIZE = 72;
const QUIZ_SIZE = 84;
const HERO_SIZE = 100;
const ACCENT_SIZE = 34;
/** Rows (offsets 80 and -52) whose free side fits a hero. */
const HERO_ROWS = [2, 5];

interface MapNode {
  id: string;
  kind: 'lesson' | 'quiz';
  state: NodeState;
  title: string;
  label: string;
  accessibilityLabel: string;
}

function buildNodes(unit: Unit): MapNode[] {
  const total = unit.lessons.length;
  const stateText = (s: NodeState, done: string, open: string) => (s === 'completed' ? done : s === 'active' ? open : 'түгжээтэй');
  return [
    ...unit.lessons.map(
      (l, i): MapNode => ({
        id: l.id,
        kind: 'lesson',
        state: l.state,
        title: l.title,
        label: l.title,
        accessibilityLabel: `Хичээл ${i + 1} / ${total}: ${l.title}, ${stateText(l.state, 'дууссан', 'идэвхтэй')}`,
      }),
    ),
    ...(unit.quiz
      ? [
          {
            id: unit.quiz.id,
            kind: 'quiz',
            state: unit.quiz.state,
            title: unit.quiz.title,
            label: unit.quiz.bestScore != null ? `Шалгалт · ${unit.quiz.bestScore}%` : 'Шалгалт',
            accessibilityLabel: `${unit.quiz.title}, ${stateText(unit.quiz.state, 'тэнцсэн', 'нээлттэй')}`,
          } satisfies MapNode,
        ]
      : []),
  ];
}

/** Smooth S-curves through the node centres. */
function trailPath(points: { x: number; y: number }[]) {
  return points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1]!;
      const dy = (p.y - prev.y) / 2;
      return `C ${prev.x} ${prev.y + dy} ${p.x} ${p.y - dy} ${p.x} ${p.y}`;
    })
    .join(' ');
}

interface Props {
  unit: Unit;
  index: number;
  onPressNode: (node: { id: string; kind: 'lesson' | 'quiz'; state: NodeState }) => void;
  /** y of a node row inside this map (for auto-scroll). */
  onNodeLayout: (nodeId: string, y: number) => void;
}

export function UnitMap({ unit, index, onPressNode, onNodeLayout }: Props) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const locked = unit.state === 'locked';
  const land = locked ? FOG : landTheme(index);
  const color = unitColor(index);
  const nodes = buildNodes(unit);
  const height = PAD_TOP + nodes.length * ROW_H + PAD_BOTTOM;

  const points = nodes.map((n, i) => ({
    x: width / 2 + ZIGZAG[i % ZIGZAG.length]!,
    y: PAD_TOP + i * ROW_H + centerInRow(n.kind === 'quiz' ? QUIZ_SIZE : LESSON_SIZE),
  }));
  // The walked part of the trail runs up to the furthest node that is open.
  const reached = nodes.reduce((last, n, i) => (n.state !== 'locked' ? i : last), 0);
  const walked = points.slice(0, reached + 1);
  // Animated set pieces go beside the rows that swing furthest from the centre.
  const heroSlots = HERO_ROWS.filter((i) => i < nodes.length);
  if (heroSlots.length === 0 && nodes.length > 0) heroSlots.push(nodes.length - 1);

  const dark = t.scheme === 'dark';
  const trailBase = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)';
  const trailDash = dark ? 'rgba(255,255,255,0.28)' : 'rgba(60,50,90,0.22)';

  return (
    <View style={[styles.land, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <LinearGradient
        colors={dark ? land.dark : land.light}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {width > 0 && (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* road bed, then dashed centre line, then the walked part on top */}
          <Path d={trailPath(points)} stroke={trailBase} strokeWidth={22} strokeLinecap="round" fill="none" />
          <Path d={trailPath(points)} stroke={trailDash} strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" fill="none" />
          {walked.length > 1 && (
            <Path d={trailPath(walked)} stroke={t.gold} strokeWidth={10} strokeLinecap="round" fill="none" opacity={0.9} />
          )}
        </Svg>
      )}

      {/* Scenery on the side of the trail that has room */}
      {width > 0 &&
        nodes.map((_, i) => {
          const offset = ZIGZAG[i % ZIGZAG.length]!;
          const left = offset > 0 || (offset === 0 && i % 2 === 0);
          const hero = heroSlots.indexOf(i);
          const size = hero >= 0 ? HERO_SIZE : ACCENT_SIZE + (i % 3) * 6;
          const inset = hero >= 0 ? width * 0.03 : width * 0.08 + (i % 3) * 6;
          return (
            <View
              key={`decor-${i}`}
              pointerEvents="none"
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.decor,
                {
                  top: points[i]!.y - size / 2 + (hero >= 0 ? 0 : i % 2 ? 14 : -6),
                  left: left ? inset : undefined,
                  right: left ? undefined : inset,
                  opacity: locked ? 0.75 : 1,
                },
              ]}>
              {hero >= 0 ? (
                <Hero kind={land.heroes[hero]!} size={size} />
              ) : (
                <Accent kind={land.accents[(i + index) % land.accents.length]!} size={size} />
              )}
            </View>
          );
        })}

      <View style={{ paddingTop: PAD_TOP }}>
        {nodes.map((n, i) => (
          <View
            key={n.id}
            style={[styles.row, { transform: [{ translateX: ZIGZAG[i % ZIGZAG.length]! }] }]}
            onLayout={(e) => onNodeLayout(n.id, e.nativeEvent.layout.y)}>
            <PathNode
              kind={n.kind}
              state={n.state}
              color={color}
              accessibilityLabel={n.accessibilityLabel}
              onPress={() => onPressNode(n)}
            />
            <View style={[styles.labelPill, { backgroundColor: dark ? 'rgba(18,17,25,0.7)' : 'rgba(255,255,255,0.85)' }]}>
              <Text variant="caption" numberOfLines={1} color={n.state === 'locked' ? 'textSecondary' : 'text'}>
                {n.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  land: { borderRadius: Radius.xl, overflow: 'hidden', marginTop: -28 },
  row: { height: ROW_H, alignItems: 'center', paddingTop: 8, gap: 8 },
  labelPill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: Radius.full, maxWidth: 170 },
  decor: { position: 'absolute' },
});
