/** Fit the fixed Roku canvas using transforms supported by older TV engines. */
export function fitViewport(): void {
  const root = document.getElementById('app');
  if (!root) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  if (!(scale > 0)) return;
  root.style.zoom = '1';
  root.style.position = 'absolute';
  root.style.transformOrigin = 'top left';
  root.style.transform = `scale(${scale})`;
  root.style.left = `${(window.innerWidth - 1920 * scale) / 2}px`;
  root.style.top = `${(window.innerHeight - 1080 * scale) / 2}px`;
}

let gapChecked = false;
/** Older TV engines accept grid gap but do not space flex children. */
export function enableLegacyLayout(): void {
  if (gapChecked) return;
  gapChecked = true;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;left:-9999px;display:flex;flex-direction:column;row-gap:1px';
  for (let i = 0; i < 2; i++) {
    const child = document.createElement('div');
    child.style.height = '1px';
    probe.appendChild(child);
  }
  document.body.appendChild(probe);
  if (probe.scrollHeight !== 3) document.documentElement.classList.add('ctv-no-flex-gap');
  probe.remove();
}
