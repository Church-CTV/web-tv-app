import { renderLeftNav as sharedRenderLeftNav } from '@ctv/shared/ui/LeftNav';
import type { LeftNavProps } from '@ctv/shared/ui/LeftNav';
export * from '@ctv/shared/ui/LeftNav';

export function renderLeftNav(props: LeftNavProps): string {
  return sharedRenderLeftNav({
    ...props,
    items: props.items.filter((item) => ['home', 'search', 'settings'].includes(item.id)),
  });
}
