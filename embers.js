// Glöd: glödande partiklar bakom sidans mörka partier (Arbeten, Kontakt, sidfot).
// I ljust läge blir glöden i stället stilla snöfall i kall koboltgrå ton.
// Ritas live i en fast canvas under innehållet. Varje glöd har ett djup: nära glöd är större,
// mjukare och följer scrollen mer, avlägsna ligger nästan still. Det ger ett djup i 3D.
// Pausas när inget mörkt parti syns, och visas inte alls vid reducerad rörelse.
(() => {
  const canvas = document.querySelector(".embers");
  const zones = [...document.querySelectorAll("[data-embers]")];
  if (!canvas || !zones.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Färgresa när glöden svalnar: het gulorange → glöd → mörkröd
  const STOPS = [
    [255, 216, 164],
    [246, 156, 88],
    [217, 116, 63],
    [166, 68, 32],
    [104, 36, 16],
  ];
  const mix = (t) => {
    const p = Math.min(Math.max(t, 0), 1) * (STOPS.length - 1);
    const i = Math.min(Math.floor(p), STOPS.length - 2);
    const f = p - i;
    return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f));
  };

  // Förritade glödsprites, en per färgsteg (snabbare än att rita gradienter varje bildruta)
  const SPRITE_STEPS = 24;
  const sprites = Array.from({ length: SPRITE_STEPS }, (_, i) => {
    const [r, g, b] = mix(i / (SPRITE_STEPS - 1));
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const c = s.getContext("2d");
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${Math.min(r + 40, 255)},${Math.min(g + 50, 255)},${Math.min(b + 60, 255)},1)`);
    grad.addColorStop(0.16, `rgba(${r},${g},${b},0.95)`);
    grad.addColorStop(0.42, `rgba(${r},${g},${b},0.26)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    return s;
  });

  // Snöflinga för ljust läge: mjuk, kall och halvgenomskinlig mot porslinsvitt
  const flake = document.createElement("canvas");
  flake.width = flake.height = 64;
  {
    const c = flake.getContext("2d");
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(120,146,190,0.95)");
    grad.addColorStop(0.35, "rgba(120,146,190,0.45)");
    grad.addColorStop(1, "rgba(120,146,190,0)");
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
  }

  let light = document.documentElement.dataset.theme === "light";
  document.addEventListener("givells:theme", (e) => {
    light = e.detail === "light";
    embers.forEach((p) => spawn(p, true)); // byt riktning direkt
  });

  let W = 0;
  let H = 0;
  let dpr = 1;
  let embers = [];
  let running = false;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let lastScroll = window.scrollY;
  const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 };

  const spawn = (e, anywhere) => {
    e.z = 0.25 + Math.pow(Math.random(), 1.7) * 0.9; // de flesta långt bort, några nära
    e.x = Math.random() * W;
    if (light) {
      // snö: faller uppifrån, långsamt och vajande
      e.y = anywhere ? Math.random() * H : -20 - Math.random() * 60;
      e.size = (8 + Math.random() * 10) * (0.4 + 0.6 * e.z) * (e.z > 0.95 ? 1.8 : 1);
      e.vy = (12 + Math.random() * 22) * (0.5 + e.z);
    } else {
      // glöd: en del stiger från nederkanten, resten tänds mitt i luften så att hela skärmen lever
      const fromBelow = !anywhere && Math.random() < 0.6;
      e.y = fromBelow ? H + 20 + Math.random() * 60 : H * (anywhere ? Math.random() : 0.25 + Math.random() * 0.75);
      e.size = (14 + Math.random() * 18) * (0.4 + 0.6 * e.z) * (e.z > 0.95 ? 1.7 : 1); // nära glöd blir mjuka "bokeh"
      e.vy = -(30 + Math.random() * 50) * (0.5 + e.z);
    }
    e.baseVx = (Math.random() - 0.5) * (light ? 16 : 10);
    e.vx = e.baseVx;
    e.swayA = 4 + Math.random() * 16;
    e.swayF = 0.35 + Math.random() * 0.8;
    e.phase = Math.random() * Math.PI * 2;
    e.flick = 5 + Math.random() * 9;
    e.heat = Math.random() * 0.2;
    e.life = anywhere ? Math.random() * 4 : 0;
    e.maxLife = light ? 14 + Math.random() * 10 : 5 + Math.random() * 7;
    return e;
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(Math.max((W * H) / 21000, 18), 72));
    while (embers.length < count) embers.push(spawn({}, true));
    embers.length = count;
  };

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;

    const scroll = window.scrollY;
    const dScroll = scroll - lastScroll;
    lastScroll = scroll;

    // Pekarens drag avtar mjukt
    pointer.vx *= 0.9;
    pointer.vy *= 0.9;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = light ? "source-over" : "lighter";

    for (const e of embers) {
      e.life += dt;
      const age = e.life / e.maxLife;

      // Djup: nära glöd följer innehållet mer när man scrollar
      e.y -= dScroll * (0.12 + e.z * 0.5);

      // Varmluft från pekaren
      const dx = e.x - pointer.x;
      const dy = e.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 160 * 160) {
        const f = (1 - Math.sqrt(d2) / 160) * e.z;
        e.vx += pointer.vx * f * 0.6;
        e.y += pointer.vy * f * 0.01;
      }
      e.vx += (e.baseVx - e.vx) * Math.min(dt * 1.4, 1);

      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (!light) e.vy *= 1 - 0.04 * dt; // glöden tappar fart när den svalnar

      const sway = Math.sin(clock * e.swayF + e.phase) * e.swayA;
      const x = e.x + sway;

      if (age >= 1 || e.y < -80 || e.y > H + 80 || x < -60 || x > W + 60) {
        spawn(e, false);
        continue;
      }

      const fadeIn = Math.min(e.life / 0.8, 1);
      const fadeOut = age > 0.65 ? 1 - (age - 0.65) / 0.35 : 1;
      const flicker = light ? 1 : 0.72 + 0.28 * Math.sin(clock * e.flick + e.phase * 3);
      const depth = 0.5 + 0.5 * e.z;
      const bokeh = e.z > 0.95 ? 0.45 : 1;
      const alpha = fadeIn * fadeOut * flicker * depth * bokeh;
      if (alpha <= 0.01) continue;

      const sprite = light ? flake : sprites[Math.floor(Math.min(1, e.heat + age) * (SPRITE_STEPS - 1))];
      const s = e.size * (0.85 + 0.15 * flicker);
      ctx.globalAlpha = light ? alpha * 0.7 : alpha;
      ctx.drawImage(sprite, x - s / 2, e.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    canvas.classList.add("is-on");
    last = performance.now();
    lastScroll = window.scrollY;
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    canvas.classList.remove("is-on");
    // låt uttoningen i CSS bli klar innan loopen stannar
    setTimeout(() => {
      if (canvas.classList.contains("is-on")) return;
      running = false;
      cancelAnimationFrame(raf);
    }, 900);
  };

  const inView = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? inView.add(entry.target) : inView.delete(entry.target)));
      if (inView.size) start();
      else stop();
    },
    { rootMargin: "120px 0px" }
  );
  zones.forEach((z) => io.observe(z));

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener(
      "pointermove",
      (e) => {
        const now = performance.now();
        const dtp = Math.max(now - pointer.t, 8) / 1000;
        if (pointer.t) {
          pointer.vx = Math.max(Math.min((e.clientX - pointer.x) / dtp, 1200), -1200) * 0.05;
          pointer.vy = Math.max(Math.min((e.clientY - pointer.y) / dtp, 1200), -1200) * 0.05;
        }
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.t = now;
      },
      { passive: true }
    );
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
})();
