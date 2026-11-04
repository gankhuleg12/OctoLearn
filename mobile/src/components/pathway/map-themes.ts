/**
 * Each unit is drawn as a region on a game-style map. Themes cycle by unit
 * index; locked units are covered in "fog" until they open.
 */
export type HeroKind = 'sheep' | 'tree' | 'house' | 'windmill' | 'boat' | 'gulls' | 'castle' | 'dragon' | 'cloud';
export type AccentKind = 'bush' | 'flower' | 'sunflower' | 'mushroom' | 'pine' | 'palm' | 'rock' | 'crystal' | 'sparkle' | 'cloud';

export interface LandTheme {
  name: string;
  light: readonly [string, string];
  dark: readonly [string, string];
  /** Animated set pieces, at most two per unit (see scenery.tsx). */
  heroes: readonly [HeroKind, HeroKind];
  /** Small static props beside the remaining nodes. */
  accents: readonly AccentKind[];
}

export const LAND_THEMES: readonly LandTheme[] = [
  { name: 'meadow', light: ['#E6F8DD', '#CDEFBE'], dark: ['#15261A', '#1B3421'], heroes: ['sheep', 'tree'], accents: ['bush', 'flower', 'mushroom', 'pine'] },
  { name: 'village', light: ['#FFF3D3', '#FFE3A8'], dark: ['#2A2414', '#352A17'], heroes: ['house', 'windmill'], accents: ['sunflower', 'bush', 'flower', 'pine'] },
  { name: 'coast', light: ['#DDF2FF', '#BFE4FF'], dark: ['#11232F', '#14293A'], heroes: ['boat', 'gulls'], accents: ['palm', 'rock', 'palm', 'bush'] },
  { name: 'kingdom', light: ['#F0E8FF', '#DFD2FF'], dark: ['#211A33', '#2A2142'], heroes: ['castle', 'dragon'], accents: ['crystal', 'sparkle', 'pine', 'sparkle'] },
];

export const FOG: Pick<LandTheme, 'light' | 'dark' | 'heroes' | 'accents'> = {
  light: ['#EEEDF3', '#E3E1EC'],
  dark: ['#1B1A24', '#20202B'],
  heroes: ['cloud', 'cloud'],
  accents: ['cloud'],
};

export function landTheme(index: number): LandTheme {
  return LAND_THEMES[index % LAND_THEMES.length]!;
}
