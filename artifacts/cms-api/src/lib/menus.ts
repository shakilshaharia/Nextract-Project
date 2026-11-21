import type { MenuLocation } from '@workspace/cms-content';

// Older sites stored separate home/page menus. Read those without rewriting
// their content; a subsequently saved canonical menu always takes precedence,
// including a deliberately empty one.
const legacyLocations: Record<MenuLocation, readonly string[]> = {
  header: ['home-header', 'page-header'],
  footer: ['page-footer', 'home-footer'],
};

export function resolveMenu<T extends { location: string }>(menus: readonly T[], location: MenuLocation): T | undefined {
  for (const name of [location, ...legacyLocations[location]]) {
    const menu = menus.find(item => item.location === name);
    if (menu) return menu;
  }
  return undefined;
}
