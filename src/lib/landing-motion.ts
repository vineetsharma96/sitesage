import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createAnchoredLetter } from './letter-physics.js';
import Matter from 'matter-js';

gsap.registerPlugin(ScrollTrigger);

function splitHeading(heading: HTMLElement) {
  if (heading.dataset.split) return;
  heading.dataset.split = 'true';
  const readable = heading.cloneNode(true) as HTMLElement;
  readable.querySelectorAll('br').forEach(br => br.replaceWith(' '));
  heading.setAttribute('aria-label', readable.textContent!.replace(/\s+/g, ' ').trim());
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    node.textContent!.split(/(\s+)/).forEach(word => {
      if (!word.trim()) { fragment.append(document.createTextNode(word)); return; }
      const mask = document.createElement('span'); mask.className = 'motion-word-mask'; mask.setAttribute('aria-hidden', 'true');
      const span = document.createElement('span'); span.className = 'motion-word'; span.textContent = word;
      mask.append(span); fragment.append(mask);
    });
    node.replaceWith(fragment);
  }
}

export function initLandingMotion() {
  const welcome = document.getElementById('welcome-screen')!;
  const skip = document.getElementById('welcome-skip')!;
  const main = document.getElementById('main-content')!;
  const nav = document.getElementById('landing-nav')!;
  const footer = document.querySelector<HTMLElement>('.landing-footer')!;
  const match = gsap.matchMedia();
  let finishIntro = () => {};
  const playLetters = document.getElementById('physics-enable')!;
  const stage = document.getElementById('physics-stage')!;
  let manualPhysics: (() => void) | undefined;
  const onPlayLetters = () => {
    if (manualPhysics) return;
    stage.classList.add('motion-enabled');
    playLetters.hidden = true;
    manualPhysics = initFallingLetters();
    ScrollTrigger.refresh();
  };
  playLetters.addEventListener('click', onPlayLetters);
  const startFromWheel = (event: WheelEvent) => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches || manualPhysics || event.deltaY <= 0 || event.ctrlKey) return;
    event.preventDefault();
    stage.dataset.pendingWheel = String(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1));
    onPlayLetters();
  };
  stage.addEventListener('wheel', startFromWheel, { passive: false });
  match.add('(prefers-reduced-motion: reduce)', () => {
    playLetters.hidden = false;
    return () => {
      manualPhysics?.(); manualPhysics = undefined;
      stage.classList.remove('motion-enabled'); playLetters.hidden = true;
    };
  });

  match.add('(prefers-reduced-motion: no-preference)', () => {
    const hero = document.getElementById('hero-title')!;
    document.querySelectorAll<HTMLElement>('.landing h1, .landing h2').forEach(splitHeading);
    let intro: gsap.core.Timeline | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    let heroEntrance: gsap.core.Tween | undefined;
    const oldOverflow = document.body.style.overflow;
    function finish() {
      if (finished) return;
      finished = true; clearTimeout(timeout); intro?.kill();
      welcome.hidden = true;
      document.body.style.overflow = oldOverflow;
      [main, nav, footer].forEach(el => el.inert = false);
      if (welcome.contains(document.activeElement)) document.querySelector<HTMLElement>('.landing-enter')?.focus({ preventScroll: true });
      heroEntrance = gsap.fromTo(hero.querySelectorAll('.motion-word'), { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .06, duration: .8, ease: 'power3.out' });
      ScrollTrigger.refresh();
    }
    finishIntro = finish;
    if (window.scrollY < 20) {
      welcome.hidden = false;
      gsap.set(welcome, { clipPath: 'inset(0% 0% 0% 0%)' });
      document.body.style.overflow = 'hidden';
      [main, nav, footer].forEach(el => el.inert = true);
      skip.focus({ preventScroll: true });
      intro = gsap.timeline({ onComplete: finish });
      intro.fromTo('.welcome-mark', { scale: .5, rotation: -60, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: .6, ease: 'power3.out' })
        .fromTo('.welcome-label', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .45 }, .1)
        .fromTo('.welcome-wordmark span', { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .07, duration: .8, ease: 'power4.out' }, .25)
        .fromTo('.welcome-caption', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .5 }, .65)
        .fromTo('.welcome-line', { scaleX: 0 }, { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0)
        .to(welcome, { clipPath: 'inset(0% 0% 100% 0%)', duration: .65, ease: 'power3.inOut' }, 1.75);
      timeout = setTimeout(finish, 3500);
    } else { finished = true; welcome.hidden = true; }

    gsap.to(hero, { y: -45, opacity: .4, ease: 'none', scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: .6 } });
    document.querySelectorAll<HTMLElement>('.landing-section h2, .closing-section h2').forEach(heading => {
      gsap.fromTo(heading.querySelectorAll('.motion-word'), { yPercent: 115, rotation: 3, opacity: .1 }, {
        yPercent: 0, rotation: 0, opacity: 1, stagger: .045, ease: 'power2.out',
        scrollTrigger: { trigger: heading, start: 'top 94%', end: 'top 55%', scrub: .5 },
      });
    });
    document.querySelectorAll<HTMLElement>('.landing-section > p, .workflow-row, .trust-details article, .trust-statement > p').forEach(el => {
      gsap.fromTo(el, { y: 40, opacity: .2 }, { y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 72%', scrub: .5 } });
    });
    gsap.fromTo('.product-preview', { scale: .93, rotationX: 5 }, { scale: 1, rotationX: 0, ease: 'none', scrollTrigger: { trigger: '.product-preview', start: 'top bottom', end: 'top 15%', scrub: .8 } });
    gsap.fromTo('.product-preview img', { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.product-preview', start: 'top bottom', end: 'bottom top', scrub: .8 } });
    document.querySelectorAll<HTMLElement>('.capability').forEach((card, index) => {
      gsap.fromTo(card, { y: 65 + index % 2 * 35, rotation: index % 2 ? 1.5 : -1.5, opacity: .25 }, {
        y: 0, rotation: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 96%', end: 'top 50%', scrub: .65 },
      });
    });
    const cleanupPhysics = initFallingLetters();
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    return () => {
      clearTimeout(timeout); intro?.kill(); heroEntrance?.kill(); welcome.hidden = true;
      gsap.set(hero.querySelectorAll('.motion-word'), { clearProps: 'transform,opacity' });
      document.body.style.overflow = oldOverflow;
      [main, nav, footer].forEach(el => el.inert = false);
      cleanupPhysics();
    };
  });
  const onSkip = () => finishIntro();
  const onKey = (event: KeyboardEvent) => { if (!welcome.hidden && (event.key === 'Escape' || event.key === 'Tab')) { event.preventDefault(); if (event.key === 'Escape') finishIntro(); else skip.focus(); } };
  skip.addEventListener('click', onSkip);
  document.addEventListener('keydown', onKey);
  window.addEventListener('pagehide', () => {
    match.revert(); skip.removeEventListener('click', onSkip); document.removeEventListener('keydown', onKey);
    playLetters.removeEventListener('click', onPlayLetters);
    stage.removeEventListener('wheel', startFromWheel);
    window.addEventListener('pageshow', event => { if (event.persisted) initLandingMotion(); }, { once: true });
  }, { once: true });
}

function initFallingLetters() {
  const stage = document.getElementById('physics-stage')!;
  const container = stage.querySelector<HTMLElement>('.physics-letters')!;
  const seeds = Array.from(container.querySelectorAll<HTMLElement>('.physics-letter'));
  const reset = document.getElementById('physics-reset')!;
  const stir = document.getElementById('physics-stir')!;
  const help = document.getElementById('physics-help')!;
  const maxLetters = seeds.length * 6;
  let disposed = false;
  let visible = false;
  let initialized = false;
  let cleanup = () => {};
  let resume = () => {};
  let pause = () => {};
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) { pause(); return; }
    if (initialized) { resume(); return; }
    initialized = true;
    const { Engine, Bodies, Body, Composite, Constraint, Sleeping } = Matter;
    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.25;
    let letters = [...seeds];
    let bodies: any[] = [];
    let sizes: { width: number; height: number }[] = [];
    let frame = 0;
    let lastTime = 0;
    let accumulatedTime = 0;
    let drag: any = null;
    let pointerId: number | null = null;
    let releasedCount = 0;
    let wheelBudget = 0;
    let touchY: number | null = null;
    let measuredWidth = 0;
    let measuredHeight = 0;
    let rainTarget = seeds.length * 2;
    const instruction = 'Letters fall from above. Scroll inside for more. Grab and drag to play.';

    function render() {
      bodies.forEach((body, index) => {
        letters[index].style.transform = `translate3d(${body.position.x - sizes[index].width / 2}px, ${body.position.y - sizes[index].height / 2}px, 0) rotate(${body.angle}rad)`;
        letters[index].style.visibility = body.isStatic ? 'hidden' : 'visible';
      });
    }
    function tick(time: number) {
      frame = 0;
      if (!visible || disposed || document.hidden) return;
      // Keep gravity consistent on slower devices without a large unstable step.
      accumulatedTime += Math.min(time - (lastTime || time - 1000 / 60), 250);
      while (accumulatedTime >= 1000 / 60) {
        Engine.update(engine, 1000 / 60); accumulatedTime -= 1000 / 60;
      }
      lastTime = time; render();
      if (drag || bodies.some(body => !body.isStatic && !body.isSleeping)) frame = requestAnimationFrame(tick);
    }
    resume = () => { if (!frame && visible && !document.hidden && !disposed) { lastTime = 0; frame = requestAnimationFrame(tick); } };
    pause = () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; accumulatedTime = 0; };
    function release() {
      if (drag) { Composite.remove(engine.world, drag); drag = null; }
      if (pointerId !== null && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
      pointerId = null; stage.classList.remove('is-dragging'); resume();
    }
    function updateState() {
      stage.dataset.droppedLetters = String(releasedCount);
      stage.dataset.wordSets = String(Math.ceil(letters.length / seeds.length));
      help.textContent = releasedCount >= maxLetters ? 'Box full. Drag the letters, or drop them again.' : instruction;
    }
    function addBatch() {
      if (letters.length >= maxLetters) return;
      const batch = bodies.length === 0 ? seeds : seeds.map(seed => {
        const clone = seed.cloneNode(true) as HTMLElement;
        clone.style.removeProperty('transform'); container.append(clone); letters.push(clone);
        return clone;
      });
      const batchSizes = batch.map(letter => ({ width: letter.offsetWidth, height: letter.offsetHeight }));
      batch.forEach((letter, index) => {
        const size = batchSizes[index];
        // Spawn across the sky, rather than releasing an assembled wordmark.
        const margin = size.width / 2 + 12;
        const spread = (index * .61803398875 + bodies.length * .137) % 1;
        const body = createAnchoredLetter(Matter, { x: margin + spread * (stage.clientWidth - margin * 2), y: -size.height / 2 - 16, width: size.width, height: size.height * .88 });
        letter.dataset.letter = String(bodies.length);
        sizes.push(size); bodies.push(body); Composite.add(engine.world, body);
      });
      render(); updateState();
    }
    function dropNext() {
      if (releasedCount >= maxLetters) return;
      if (releasedCount >= bodies.length) addBatch();
      const body = bodies[releasedCount];
      Body.setStatic(body, false); Sleeping.set(body, false);
      body.restitution = .07; body.frictionAir = .001;
      Body.setAngle(body, Math.sin(releasedCount * 2.4) * .45);
      Body.setAngularVelocity(body, (releasedCount % 2 ? 1 : -1) * .012);
      releasedCount++; updateState(); resume();
    }
    function consumeScroll(delta: number) {
      wheelBudget += Math.min(delta, 320);
      while (wheelBudget >= 55 && releasedCount < maxLetters) { wheelBudget -= 55; dropNext(); }
    }
    function wheel(event: WheelEvent) {
      if (event.ctrlKey || event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || releasedCount >= maxLetters) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      consumeScroll(delta);
    }
    function layout(preserve = true) {
      const previousCount = preserve ? releasedCount : 0;
      release(); Composite.clear(engine.world, false); Engine.clear(engine);
      letters.slice(seeds.length).forEach(letter => letter.remove()); letters = [...seeds]; bodies = []; sizes = [];
      releasedCount = 0; wheelBudget = 0;
      measuredWidth = stage.clientWidth; measuredHeight = stage.clientHeight;
      const floor = measuredHeight - (window.matchMedia('(max-width: 700px)').matches ? 126 : 84);
      Composite.add(engine.world, [
        Bodies.rectangle(measuredWidth / 2, floor + 30, measuredWidth + 120, 60, { isStatic: true }),
        Bodies.rectangle(-30, measuredHeight / 2, 60, measuredHeight * 4, { isStatic: true }),
        Bodies.rectangle(measuredWidth + 30, measuredHeight / 2, 60, measuredHeight * 4, { isStatic: true }),
      ]);
      addBatch(); stage.classList.add('is-physical');
      for (let i = 0; i < previousCount; i++) dropNext();
      render(); updateState();
    }
    function point(event: PointerEvent) { const rect = stage.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
    function down(event: PointerEvent) {
      const letter = (event.target as HTMLElement).closest<HTMLElement>('.physics-letter');
      if (!letter || event.button !== 0) return;
      const body = bodies[Number(letter.dataset.letter)];
      Body.setStatic(body, false);
      const position = point(event);
      const dx = position.x - body.position.x; const dy = position.y - body.position.y;
      drag = Constraint.create({ pointA: position, bodyB: body, pointB: { x: dx * Math.cos(body.angle) + dy * Math.sin(body.angle), y: -dx * Math.sin(body.angle) + dy * Math.cos(body.angle) }, stiffness: .2, damping: .12, length: 0 });
      Sleeping.set(body, false); Composite.add(engine.world, drag);
      pointerId = event.pointerId; stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging'); resume();
    }
    function move(event: PointerEvent) { if (drag && event.pointerId === pointerId) { drag.pointA = point(event); Sleeping.set(drag.bodyB, false); resume(); } }
    function scatter() {
      bodies.forEach((body, index) => { Body.setStatic(body, false); Sleeping.set(body, false); Body.setVelocity(body, { x: Math.sin(index * 2.7) * 5, y: -8 - index % 3 * 2 }); Body.setAngularVelocity(body, (index % 2 ? 1 : -1) * .09); });
      releasedCount = bodies.length; updateState(); resume();
    }
    function dropAgain() { rainTarget = seeds.length * 2; layout(false); dropNext(); }
    function touchStart(event: TouchEvent) { touchY = event.touches[0]?.clientY ?? null; }
    function touchMove(event: TouchEvent) {
      const y = event.touches[0]?.clientY;
      if (y === undefined || touchY === null || drag) return;
      const delta = touchY - y; touchY = y;
      if (delta > 0 && releasedCount < maxLetters) { event.preventDefault(); consumeScroll(delta); }
    }
    function keyboard(event: KeyboardEvent) {
      if (event.target !== stage || !['ArrowDown', ' '].includes(event.key)) return;
      if (releasedCount < maxLetters) { event.preventDefault(); dropNext(); }
    }
    const resize = new ResizeObserver(() => { if (stage.clientWidth !== measuredWidth || stage.clientHeight !== measuredHeight) layout(); });
    layout(false); resize.observe(stage);
    dropNext();
    // Two staggered words greet the visitor, just as the reference footer rains
    // its phrase. Further deliberate scrolling continues filling the same world.
    const rain = window.setInterval(() => {
      if (visible && !document.hidden && releasedCount < rainTarget) dropNext();
    }, 360);
    document.fonts.ready.then(() => { if (!disposed) layout(); });
    const queued = Number(stage.dataset.pendingWheel || 0); delete stage.dataset.pendingWheel;
    if (queued > 0) consumeScroll(queued);
    stage.addEventListener('wheel', wheel, { passive: false });
    stage.addEventListener('pointerdown', down); stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', release); stage.addEventListener('pointercancel', release);
    stage.addEventListener('touchstart', touchStart, { passive: true }); stage.addEventListener('touchmove', touchMove, { passive: false });
    stage.addEventListener('keydown', keyboard);
    reset.addEventListener('click', dropAgain); stir.addEventListener('click', scatter);
    const visibility = () => document.hidden ? pause() : resume();
    document.addEventListener('visibilitychange', visibility);
    cleanup = () => {
      clearInterval(rain); pause(); release(); resize.disconnect(); Composite.clear(engine.world, false); Engine.clear(engine);
      letters.slice(seeds.length).forEach(letter => letter.remove()); seeds.forEach(letter => { letter.style.removeProperty('transform'); letter.style.removeProperty('visibility'); });
      stage.classList.remove('is-physical', 'is-dragging');
      stage.removeEventListener('wheel', wheel); stage.removeEventListener('pointerdown', down); stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', release); stage.removeEventListener('pointercancel', release);
      stage.removeEventListener('touchstart', touchStart); stage.removeEventListener('touchmove', touchMove); stage.removeEventListener('keydown', keyboard);
      reset.removeEventListener('click', dropAgain); stir.removeEventListener('click', scatter); document.removeEventListener('visibilitychange', visibility);
      delete stage.dataset.droppedLetters; delete stage.dataset.wordSets; help.textContent = instruction;
    };
  }, { threshold: .05 });
  observer.observe(stage);
  return () => { disposed = true; observer.disconnect(); cleanup(); };
}
