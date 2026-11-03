import type { Catalog } from '../shared/catalog';
import type { Journey, JourneyDefinition } from '../shared/journey-map';
import { element, text } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function createMapBoard(select: (id: string) => void) {
  const viewport = element('#map-viewport');
  const camera = text('div', '', 'map-camera');
  const plane = text('div', '', 'map-plane');
  camera.append(plane);
  viewport.append(camera);
  let map: JourneyDefinition | null = null;
  let positions: Journey['heroes'] = [];
  let activeHeroId: string | null = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let needsLayout = false;
  let layoutWidth = 0;
  let dragging: { id: number; x: number; y: number } | null = null;
  const actors = new Map<string, HTMLElement>();
  const spaces = new Map<string, { button: HTMLButtonElement; highlight: SVGGElement }>();
  function transform() {
    camera.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
    camera.style.setProperty('--map-inverse-zoom', String(1 / zoom));
  }
  function changeZoom(delta: number) {
    zoom = Math.max(0.7, Math.min(2.5, zoom + delta));
    transform();
  }
  function pan(x: number, y: number) {
    panX = Math.max(-600, Math.min(600, panX + x));
    panY = Math.max(-600, Math.min(600, panY + y));
    transform();
  }
  function center() {
    const position = positions.find((hero) => hero.heroId === activeHeroId) ?? positions[0];
    const target = map?.spaces.find((space) => space.id === position?.spaceId);
    if (!map || !target) return;
    panX = (0.5 - target.x / map.width) * camera.clientWidth * zoom;
    panY = (0.5 - target.y / map.height) * camera.clientHeight * zoom * 0.94;
    transform();
  }
  function layout() {
    if (!map || !viewport.clientWidth) return;
    if (needsLayout) {
      zoom = viewport.clientWidth < 600 ? 2 : 0.82;
      needsLayout = false;
    } else if (layoutWidth)
      zoom = Math.max(0.7, Math.min(2.5, (zoom * layoutWidth) / camera.clientWidth));
    layoutWidth = camera.clientWidth;
    center();
  }
  // The guided path can reveal this panel after draw; measure its visible size.
  new ResizeObserver(layout).observe(viewport);
  viewport.onpointerdown = (event) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button')))
      return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.setPointerCapture(event.pointerId);
  };
  viewport.onpointermove = (event) => {
    if (dragging?.id !== event.pointerId) return;
    pan(event.clientX - dragging.x, event.clientY - dragging.y);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
  };
  viewport.onpointerup = viewport.onpointercancel = () => {
    dragging = null;
  };
  viewport.onkeydown = (event) => {
    if (event.target !== viewport) return;
    const delta = {
      ArrowLeft: [-40, 0],
      ArrowRight: [40, 0],
      ArrowUp: [0, -40],
      ArrowDown: [0, 40],
    }[event.key];
    if (delta) {
      event.preventDefault();
      pan(delta[0]!, delta[1]!);
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      changeZoom(0.2);
    } else if (event.key === '-') {
      event.preventDefault();
      changeZoom(-0.2);
    } else if (event.key === 'Home') {
      event.preventDefault();
      center();
    }
  };
  element('#map-zoom-in').onclick = () => changeZoom(0.2);
  element('#map-zoom-out').onclick = () => changeZoom(-0.2);
  element('#map-pan-left').onclick = () => pan(-60, 0);
  element('#map-pan-right').onclick = () => pan(60, 0);
  element('#map-center').onclick = center;
  const motion = element<HTMLInputElement>('#map-reduced-motion');
  motion.checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  motion.onchange = () => {
    viewport.classList.toggle('map-no-motion', motion.checked);
    document.body.classList.toggle('reduce-motion', motion.checked);
  };
  viewport.classList.toggle('map-no-motion', motion.checked);
  document.body.classList.toggle('reduce-motion', motion.checked);

  return {
    draw(
      definition: JourneyDefinition,
      heroes: Journey['heroes'],
      catalog: Catalog,
      unexplored = new Set<string>(),
    ) {
      map = definition;
      positions = heroes;
      actors.clear();
      spaces.clear();
      plane.replaceChildren();
      camera.style.aspectRatio = `${map.width} / ${map.height}`;
      const drawing = svg('svg', {
        viewBox: `0 0 ${map.width} ${map.height}`,
        'aria-hidden': 'true',
      });
      const defs = svg('defs');
      const clip = svg('clipPath', { id: 'journey-outline' });
      const base = svg('g', { class: 'map-ground-shape' });
      const highlights = svg('g');
      for (const [index, space] of map.spaces.entries()) {
        const highlight = svg('g', {
          class: `map-space-highlight${unexplored.has(space.id) ? ' map-space-unexplored' : ''}`,
        });
        for (const hex of space.hexes) {
          const points = hex.polygon.map((point) => `${point.x},${point.y}`).join(' ');
          clip.append(svg('polygon', { points }));
          base.append(svg('polygon', { points }));
          highlight.append(svg('polygon', { points }));
        }
        highlights.append(highlight);
        const button = text('button', String(index + 1), 'map-space') as HTMLButtonElement;
        button.type = 'button';
        button.setAttribute('aria-label', `Seleziona ${space.label}`);
        button.dataset.spaceId = space.id;
        button.style.left = `${(space.x / map.width) * 100}%`;
        button.style.top = `${(space.y / map.height) * 100}%`;
        button.onclick = () => select(space.id);
        spaces.set(space.id, { button, highlight });
      }
      defs.append(clip);
      drawing.append(defs, base);
      element('#map-image-note').hidden = Boolean(map.image);
      if (map.image) {
        const image = svg('image', {
          href: `/api/map-content/${encodeURIComponent(map.image)}`,
          width: String(map.width),
          height: String(map.height),
          'clip-path': 'url(#journey-outline)',
        });
        image.onerror = () => {
          image.remove();
          element('#map-image-note').hidden = false;
        };
        drawing.append(image);
      }
      drawing.append(highlights);
      plane.append(drawing);
      for (const space of spaces.values()) plane.append(space.button);
      for (const hero of heroes) {
        const definition = catalog.heroes.find((entry) => entry.id === hero.heroId)!;
        const actor = text('div', '', 'map-actor');
        actor.dataset.heroId = hero.heroId;
        actor.setAttribute('aria-hidden', 'true');
        if (definition.portrait) {
          const image = document.createElement('img');
          image.src = `/api/content/${encodeURIComponent(definition.portrait)}`;
          image.alt = '';
          image.onerror = () => {
            image.remove();
            actor.append(text('span', definition.name.text.slice(0, 1)));
          };
          actor.append(image);
        } else actor.append(text('span', definition.name.text.slice(0, 1)));
        plane.append(actor);
        actors.set(hero.heroId, actor);
      }
      needsLayout = true;
      panX = 0;
      panY = 0;
      transform();
      requestAnimationFrame(layout);
    },
    update(heroes: Journey['heroes'], active: string | null, selected: string) {
      if (!map) return;
      positions = heroes;
      activeHeroId = active;
      for (const [id, space] of spaces) {
        space.button.setAttribute('aria-pressed', String(id === selected));
        space.highlight.classList.toggle('selected', id === selected);
      }
      for (const hero of heroes) {
        const space = map.spaces.find((entry) => entry.id === hero.spaceId)!;
        const actor = actors.get(hero.heroId)!;
        actor.hidden = !!hero.removed;
        const together = heroes.filter((entry) => !entry.removed && entry.spaceId === hero.spaceId);
        const offset =
          (together.findIndex((entry) => entry.heroId === hero.heroId) -
            (together.length - 1) / 2) *
          24;
        actor.style.left = `${(space.x / map.width) * 100}%`;
        actor.style.top = `${(space.y / map.height) * 100}%`;
        actor.style.setProperty('--actor-offset', `${offset}px`);
        actor.classList.toggle('active', hero.heroId === active);
        actor.dataset.spaceId = hero.spaceId;
      }
    },
  };
}
