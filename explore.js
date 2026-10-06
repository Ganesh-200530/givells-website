// Kakelugnen i 3D. En kakelugn byggd helt i kod med three.js (lokalt i assets/vendor) och WebGL.
// Scrollen driver fyra kapitel: helheten, kaklet som lossnar, kärnan med rökkanalerna och värmen.
// Kakelugnen kan vridas med mus eller finger. Three.js laddas först när man närmar sig avsnittet,
// och utan WebGL visas ett foto i stället.

const section = document.getElementById("kakelugnen");

function init() {
  const track = section.querySelector(".explore__track");
  const chapters = [...section.querySelectorAll(".explore__chapter")];
  const steps = [...section.querySelectorAll(".explore__steps button")];
  const stage = section.querySelector(".explore__stage");
  const canvas = section.querySelector(".explore__canvas");
  const labelsEl = section.querySelector(".explore__labels");
  const loading = section.querySelector(".explore__loading");
  const fallback = section.querySelector(".explore__fallback");
  const hint = section.querySelector(".explore__hint");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let active = -1;
  let ticking = false;

  const progress = () => {
    const rect = track.getBoundingClientRect();
    const scrollable = track.offsetHeight - window.innerHeight;
    return scrollable > 0 ? clamp(-rect.top / scrollable, 0, 1) : 0;
  };

  // Kapiteltext och förloppsstreck följer scrollen, även innan 3D-modellen har laddats
  const updateChapters = () => {
    ticking = false;
    const p = progress();
    const idx = Math.min(3, Math.floor(p * 4));
    if (idx !== active) {
      active = idx;
      chapters.forEach((c, i) => c.classList.toggle("is-active", i === idx));
      steps.forEach((b, i) => (i === idx ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
    }
    steps.forEach((b, i) => b.querySelector("i").style.setProperty("--fill", clamp(p * 4 - i, 0, 1).toFixed(3)));
  };

  const goTo = (i) => {
    const top = track.getBoundingClientRect().top + window.scrollY;
    const scrollable = track.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.55) / 4) * scrollable, behavior: reduce ? "auto" : "smooth" });
  };
  steps.forEach((b, i) => b.addEventListener("click", () => goTo(i)));
  chapters.forEach((c, i) => c.addEventListener("focusin", () => i !== active && goTo(i)));

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateChapters);
  }, { passive: true });
  updateChapters();

  // Ladda 3D när avsnittet är på väg in i bild
  let started = false;
  const load = async () => {
    if (started) return;
    started = true;
    try {
      if (!webglAvailable()) throw new Error("WebGL saknas");
      const THREE = await import("./assets/vendor/three.module.min.js");
      buildScene(THREE, { section, canvas, stage, labelsEl, hint, reduce, progress });
      canvas.classList.add("is-ready");
    } catch {
      fallback.hidden = false;
      hint.hidden = true;
    } finally {
      loading.classList.add("is-done");
    }
  };
  const near = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    near.disconnect();
    load();
  }, { rootMargin: "150% 0px" });
  near.observe(section);
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------
// Scenen

function buildScene(THREE, { section, canvas, stage, labelsEl, hint, reduce, progress }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // håller det vita kaklet vitt
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(THREE, renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a2c22, 0.6);
  const key = new THREE.DirectionalLight(0xfffaf2, 2.1);
  key.position.set(-2.6, 3.6, 3.2);
  const rim = new THREE.DirectionalLight(0xbfd2ff, 0.85); // kallt vinterljus från ett fönster
  rim.position.set(3, 2.4, -3);
  scene.add(hemi, key, rim);

  // Material
  const glaze = new THREE.MeshPhysicalMaterial({
    color: 0xfbf9f4,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    normalMap: makeReliefNormalMap(THREE),
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.9,
  });
  const glazePlain = new THREE.MeshPhysicalMaterial({ color: 0xfbf9f4, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 });
  const biscuit = new THREE.MeshStandardMaterial({ color: 0xcdb391, roughness: 0.92 }); // kakelets baksida
  const brass = new THREE.MeshStandardMaterial({ color: 0xc0903f, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2724, metalness: 0.6, roughness: 0.55 });
  const brick = new THREE.MeshStandardMaterial({ map: makeBrickTexture(THREE), roughness: 0.88, transparent: true, side: THREE.DoubleSide });

  const stove = new THREE.Group();
  scene.add(stove);

  // Fot, mittlist och kröns list (svarvade profiler)
  const lathe = (pts, mat) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 96), mat);
  const base = lathe([[0, 0], [0.4, 0], [0.4, 0.03], [0.385, 0.045], [0.39, 0.07], [0.37, 0.1], [0.36, 0.13], [0.345, 0.16], [0, 0.16]], glazePlain);
  const midRing = lathe([[0, 0.86], [0.345, 0.86], [0.37, 0.875], [0.385, 0.9], [0.385, 0.93], [0.36, 0.945], [0.335, 0.96], [0, 0.96]], glazePlain);
  const topRing = lathe([[0, 1.88], [0.335, 1.88], [0.36, 1.9], [0.39, 1.93], [0.395, 1.96], [0.37, 1.99], [0.33, 2.0], [0, 2.0]], glazePlain);
  stove.add(base, midRing, topRing);
  // ringarna skalas kring sin egen höjd när ugnen tas isär
  for (const [ring, y] of [[midRing, 0.91], [topRing, 1.94]]) {
    ring.geometry.translate(0, -y, 0);
    ring.position.y = y;
  }

  // Krönet med tinnar och en liten kupol
  const crown = new THREE.Group();
  crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.315, 0.13, 64), glazePlain));
  crown.children[0].position.y = 0.065;
  const merlon = new THREE.BoxGeometry(0.085, 0.07, 0.035);
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(merlon, glazePlain);
    const a = (i / 16) * Math.PI * 2;
    m.position.set(Math.sin(a) * 0.29, 0.165, Math.cos(a) * 0.29);
    m.rotation.y = a;
    crown.add(m);
  }
  const garland = new THREE.Mesh(new THREE.TorusGeometry(0.313, 0.01, 8, 96), glazePlain);
  garland.rotation.x = Math.PI / 2;
  garland.position.y = 0.06;
  crown.add(garland, lathe([[0, 0.13], [0.27, 0.13], [0.27, 0.15], [0.24, 0.17], [0.12, 0.2], [0, 0.21]], glazePlain));
  crown.position.y = 2.0;
  stove.add(crown);

  // Kaklet: krökta plattor som instanser, så att varje platta kan lossna för sig
  const tiles = [];
  const makeShell = ({ r, y0, rows, h, skip }) => {
    const cols = 8;
    const geo = curvedTile(THREE, r, 0.022, Math.PI / cols - 0.006, h - 0.006, 8);
    const list = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (skip && skip(row, col)) continue;
        list.push({ a: (col / cols) * Math.PI * 2, y: y0 + row * h + 0.003, h, r, jitter: Math.random() });
      }
    }
    const mesh = new THREE.InstancedMesh(geo, [glaze, biscuit], list.length);
    mesh.frustumCulled = false;
    const tint = new THREE.Color();
    list.forEach((t, i) => {
      const v = 0.965 + Math.random() * 0.035; // handgjort: små skillnader i glasyren
      mesh.setColorAt(i, tint.setRGB(v, v * (0.985 + Math.random() * 0.015), v * (0.96 + Math.random() * 0.03)));
    });
    stove.add(mesh);
    tiles.push({ mesh, list });
  };
  // Nedre delen: luckorna sitter där två plattor saknas
  makeShell({ r: 0.345, y0: 0.16, rows: 5, h: 0.14, skip: (row, col) => col === 0 && (row === 1 || row === 2) });
  makeShell({ r: 0.335, y0: 0.96, rows: 6, h: 0.92 / 6 });

  // Kärnan av tegel och bruk, med ett snitt framtill (syns när kaklet lossnat)
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.84, 48, 1, false, 0.45, Math.PI * 2 - 0.9), brick);
  core.position.y = 0.16 + 0.92;
  stove.add(core);

  // Eldstaden: en mörk kammare, glöd, vedträn och lågor
  const chamber = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x3b1f14, roughness: 1, emissive: 0x5a1e08, emissiveIntensity: 0.6, side: THREE.BackSide })
  );
  chamber.position.set(0, 0.44, 0.15);
  const logMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 1, emissive: 0x7a2a08, emissiveIntensity: 0.8 });
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.22, 10), logMat);
  logA.rotation.set(0, 0.4, Math.PI / 2);
  logA.position.set(0, 0.315, 0.16);
  const logB = logA.clone();
  logB.rotation.set(0, -0.5, Math.PI / 2);
  logB.position.set(0, 0.335, 0.2);
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.2),
    new THREE.MeshBasicMaterial({ map: makeGlowTexture(THREE, [255, 120, 40]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, 0.296, 0.17);
  stove.add(chamber, logA, logB, bed);

  const flameMat = (seed) => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: FLAME_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flames = [[-0.05, 0.15, 0.24, 1.7], [0.045, 0.13, 0.2, 4.1], [0, 0.17, 0.28, 7.3]].map(([x, w, h, seed]) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), flameMat(seed));
    f.position.set(x, 0.3 + h / 2, 0.16);
    stove.add(f);
    return f;
  });

  const fireLight = new THREE.PointLight(0xff7a2e, 2.4, 1.5, 2);
  fireLight.position.set(0, 0.45, 0.46);
  const innerLight = new THREE.PointLight(0xff6a20, 1.2, 0.7, 2);
  innerLight.position.set(0, 0.42, 0.15);
  stove.add(fireLight, innerLight);

  // Luckor, ram och spjällknopp i mässing
  const front = new THREE.Group();
  const band = (y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.352, 0.028, 16, 1, true, -0.41, 0.82), brass);
    m.material.side = THREE.DoubleSide;
    m.position.y = y;
    return m;
  };
  front.add(band(0.296), band(0.584));
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.31, 0.022), brass);
    post.position.set(s * Math.sin(0.4) * 0.35, 0.44, Math.cos(0.4) * 0.35);
    post.rotation.y = s * 0.4;
    front.add(post);

    const hinge = new THREE.Group();
    hinge.position.set(s * 0.135, 0.44, 0.355);
    hinge.rotation.y = s * 1.15; // luckorna står öppna
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.27, 0.012), brass);
    leaf.position.x = -s * 0.065;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 8, 32), brass);
    ring.position.set(-s * 0.065, 0.02, 0.008);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 16, 12), brass);
    knob.position.set(-s * 0.115, 0, 0.014);
    hinge.add(leaf, ring, knob);
    front.add(hinge);
  }
  stove.add(front);

  const vent = new THREE.Group();
  const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 32), brass);
  rosette.rotation.x = Math.PI / 2;
  const ventKnob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 16), brass);
  ventKnob.position.z = 0.022;
  vent.add(rosette, ventKnob);
  vent.position.set(0, 1.62, 0.34);
  stove.add(vent);

  // Eldstadsplåt på golvet framför luckorna
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.008, 0.42), iron);
  plate.position.set(0, 0.004, 0.53);
  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 48),
    new THREE.MeshBasicMaterial({ map: makeGlowTexture(THREE, [255, 130, 50]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, 0.012, 0.6);
  stove.add(plate, floorGlow);

  // Mjuk skugga under kakelugnen (roterar inte)
  const shadowMat = new THREE.MeshBasicMaterial({ map: makeShadowTexture(THREE), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);

  // Rökkanalerna: röken går upp, ner, upp, ner och upp igen innan den når skorstenen
  const path = new THREE.CatmullRomCurve3(
    [
      [0, 0.4, 0.08], [0, 0.72, 0.03], [0, 1.25, 0], [0, 1.8, 0],
      [0.1, 1.86, 0.05], [0.17, 1.7, 0.08], [0.18, 1.2, 0.07], [0.16, 0.98, 0.05],
      [0.08, 0.92, -0.1], [0.01, 1.0, -0.18], [-0.03, 1.42, -0.2], [-0.03, 1.79, -0.17],
      [-0.12, 1.85, -0.08], [-0.18, 1.62, 0.02], [-0.19, 1.2, 0.05], [-0.16, 1.0, 0.04],
      [-0.08, 0.96, -0.05], [-0.06, 1.35, -0.1], [-0.03, 1.86, -0.12], [0, 2.08, -0.16], [0, 2.36, -0.21],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "catmullrom",
    0.4
  );
  const flowMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFlow: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: FLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flow = new THREE.Mesh(new THREE.TubeGeometry(path, 640, 0.022, 10, false), flowMat);
  flow.visible = false;
  stove.add(flow);

  // Etiketter som följer delarna
  const LABELS = [
    { text: "Glaserat kakel", ch: [0, 1], at: (s) => radial(0.82, 1.42, 0.335 + tileOffset(s.explode)), normal: 0.82 },
    { text: "Mässingsluckor", ch: [0, 3], at: (s) => new THREE.Vector3(0.0, 0.47, 0.37 + tileOffset(s.explode)), normal: 0 },
    { text: "Krön", ch: [0], at: (s) => new THREE.Vector3(0, 2.2 + s.explode * 0.3, 0.27), normal: 0 },
    { text: "Tegel och bruk", ch: [1], at: () => radial(-0.95, 1.3, 0.3), normal: -0.95 },
    { text: "Rökkanaler", ch: [2], at: () => path.getPointAt(0.33), normal: null },
    { text: "Eldstad", ch: [2], at: () => new THREE.Vector3(0, 0.42, 0.16), normal: null },
    { text: "Till skorstenen", ch: [2], at: () => path.getPointAt(1), normal: null },
    { text: "Värmen strålar ut i rummet", ch: [3], at: () => radial(1.35, 1.15, 0.345), normal: 1.35 },
  ];
  function radial(a, y, r) {
    return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  }
  function tileOffset(e) {
    return smooth(0, 1, clamp(e * 1.35 - 0.12, 0, 1)) * 0.24;
  }
  const labelEls = LABELS.map((l) => {
    const el = document.createElement("div");
    el.className = "explore__label";
    el.innerHTML = "<i></i><b></b><span></span>";
    el.querySelector("span").textContent = l.text;
    labelsEl.append(el);
    return el;
  });

  // Tillstånd som följer scrollen mjukt
  const state = { explode: 0, xray: 0, flow: 0, fire: 0.85, zoom: 1, lift: 0 };
  const targets = (p) => {
    const explode = smooth(0.16, 0.3, p) - smooth(0.72, 0.86, p);
    const xray = smooth(0.42, 0.52, p) - smooth(0.7, 0.8, p);
    return {
      explode,
      xray,
      flow: smooth(0.47, 0.66, p) * (1 - smooth(0.72, 0.8, p)),
      fire: 0.85 + 0.45 * smooth(0.76, 0.9, p),
      zoom: 1 - 0.12 * xray,
      lift: 0.22 * xray,
    };
  };

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const Y = new THREE.Vector3(0, 1, 0);
  let lastExplode = -1;
  const applyExplode = (e) => {
    if (Math.abs(e - lastExplode) < 1e-4) return;
    lastExplode = e;
    for (const { mesh, list } of tiles) {
      list.forEach((t, i) => {
        const delay = (1 - (t.y - 0.16) / 1.75) * 0.35; // översta raderna lossnar först
        const k = smooth(0, 1, clamp(e * 1.35 - delay, 0, 1));
        const off = k * (0.2 + t.jitter * 0.08);
        const dy = (t.y + t.h / 2 - 1.1) * 0.1 * k;
        quat.setFromAxisAngle(Y, t.a + (t.jitter - 0.5) * 0.12 * k);
        pos.set(Math.sin(t.a) * off, t.y + dy, Math.cos(t.a) * off);
        mesh.setMatrixAt(i, matrix.compose(pos, quat, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    // luckorna och spjällknoppen följer kaklet utåt
    const z = tileOffset(e);
    front.position.z = z;
    vent.position.z = 0.34 + z;
    const lift = smooth(0, 1, e);
    crown.position.y = 2.0 + lift * 0.3;
    topRing.position.y = 1.94 + lift * 0.18;
    topRing.scale.set(1 + lift * 0.3, 1, 1 + lift * 0.3);
    midRing.scale.set(1 + lift * 0.45, 1, 1 + lift * 0.45);
  };

  // Storlek och kamera
  const fit = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(stage);
  fit();

  const lookAt = new THREE.Vector3();
  const placeCamera = () => {
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = 1.05 + state.explode * 0.75;
    const distV = 2.75 / 2 / half;
    const distH = width / 2 / (half * camera.aspect);
    const dist = Math.max(distV, distH) * 1.06 * state.zoom;
    camera.position.set(0, 1.5 + state.lift * 1.4, dist);
    lookAt.set(0, 1.12 + state.lift * 0.4, 0);
    camera.lookAt(lookAt);
  };

  // Vrida med mus eller finger (vågrätt), med eftersving
  let rotY = -0.55;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  let lastT = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    hint.classList.add("is-gone");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const d = (e.clientX - lastX) * 0.009;
    rotY += d;
    vel = clamp(d / Math.max((now - lastT) / 1000, 0.008), -6, 6);
    lastX = e.clientX;
    lastT = now;
  });
  const release = () => { dragging = false; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // Tema: skuggan och ljuset anpassas efter mörkt eller ljust läge
  const applyTheme = (theme) => {
    const light = theme === "light";
    shadowMat.opacity = light ? 0.45 : 0.85;
    hemi.intensity = light ? 0.75 : 0.55;
    renderer.toneMappingExposure = light ? 1.08 : 1.0;
  };
  applyTheme(document.documentElement.dataset.theme);
  document.addEventListener("givells:theme", (e) => applyTheme(e.detail));

  // Etiketter: projicera 3D-punkter till skärmen, dölj dem som vänder bort
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const updateLabels = (chapter) => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const narrow = w < 520;
    let shown = 0;
    LABELS.forEach((l, i) => {
      const el = labelEls[i];
      let on = l.ch.includes(chapter) && !(narrow && shown >= 2);
      if (on) {
        v.copy(l.at(state));
        if (l.normal !== null) {
          n.set(Math.sin(l.normal + rotY), 0, Math.cos(l.normal + rotY));
          stove.localToWorld(v);
          camDir.copy(camera.position).sub(v).normalize();
          on = n.dot(camDir) > 0.2;
        } else {
          stove.localToWorld(v);
        }
      }
      if (on) {
        shown++;
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        const lw = el.offsetWidth;
        // texten hamnar på den sida som har plats, och aldrig utanför scenen
        let left = x < w / 2;
        if (left && x - lw < 4) left = false;
        else if (!left && x + lw > w - 4) left = true;
        const lx = clamp(left ? x - lw : x, 4, Math.max(4, w - lw - 4));
        el.classList.toggle("is-left", left);
        el.style.transform = `translate3d(${lx.toFixed(1)}px, ${(y - el.offsetHeight / 2).toFixed(1)}px, 0)`;
      }
      el.classList.toggle("is-on", on);
    });
  };

  // Renderloopen körs bara när avsnittet syns
  let running = false;
  let raf = 0;
  let prev = performance.now();
  let time = 0;
  let lastP = progress();
  const autoSpeed = reduce ? 0 : 0.14;

  const frame = (now) => {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    time += dt;

    const p = progress();
    const T = targets(p);
    const k = reduce ? 1 : 1 - Math.exp(-dt * 5);
    for (const key of Object.keys(T)) state[key] += (T[key] - state[key]) * k;

    if (!dragging) {
      vel *= Math.exp(-dt * 2.5);
      rotY += (vel + autoSpeed) * dt;
    }
    if (!reduce) rotY += (p - lastP) * 4;
    lastP = p;
    stove.rotation.y = rotY;

    applyExplode(state.explode);

    brick.opacity = 1 - state.xray * 0.8;
    brick.depthWrite = state.xray < 0.05;
    flow.visible = state.flow > 0.002;
    flowMat.uniforms.uFlow.value = state.flow;
    flowMat.uniforms.uTime.value = time;

    const flicker = reduce ? 1 : 0.86 + 0.09 * Math.sin(time * 13.1) + 0.06 * Math.sin(time * 7.3 + 1.3) + 0.05 * Math.sin(time * 23.7 + 0.4);
    fireLight.intensity = 2.4 * state.fire * flicker;
    innerLight.intensity = 1.3 * state.fire * flicker;
    floorGlow.material.opacity = 0.55 * state.fire * flicker;
    bed.material.opacity = 0.9 * flicker;
    for (const f of flames) {
      f.material.uniforms.uTime.value = reduce ? 0 : time;
      f.material.uniforms.uIntensity.value = state.fire;
      f.rotation.y = -rotY; // lågorna vänder sig alltid mot kameran
    }

    placeCamera();
    renderer.render(scene, camera);
    updateLabels(Math.min(3, Math.floor(p * 4)));

    if (running) raf = requestAnimationFrame(frame);
  };

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!entry.isIntersecting) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }).observe(section);

  // en första bild direkt, så att den finns när avsnittet scrollas in
  applyExplode(0);
  placeCamera();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------------------------
// Geometri och texturer

// En krökt kakelplatta med tjocklek. Grupp 0 = glaserad framsida, grupp 1 = kanter och baksida.
function curvedTile(THREE, r, thick, halfAngle, h, segs) {
  const pos = [];
  const nor = [];
  const uv = [];
  const ri = r - thick;
  const P = (rad, a, y) => [Math.sin(a) * rad, y, Math.cos(a) * rad];
  const quad = (a, b, c, d, na, nb, nc, nd, ua = [0, 0], ub = [1, 0], uc = [1, 1], ud = [0, 1]) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    nor.push(...na, ...nb, ...nc, ...na, ...nc, ...nd);
    uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
  };
  const angle = (i) => -halfAngle + (2 * halfAngle * i) / segs;
  for (let i = 0; i < segs; i++) {
    const a0 = angle(i);
    const a1 = angle(i + 1);
    const n0 = [Math.sin(a0), 0, Math.cos(a0)];
    const n1 = [Math.sin(a1), 0, Math.cos(a1)];
    quad(P(r, a0, 0), P(r, a1, 0), P(r, a1, h), P(r, a0, h), n0, n1, n1, n0, [i / segs, 0], [(i + 1) / segs, 0], [(i + 1) / segs, 1], [i / segs, 1]);
  }
  const outer = pos.length / 3;
  for (let i = 0; i < segs; i++) {
    const a0 = angle(i);
    const a1 = angle(i + 1);
    const n0 = [-Math.sin(a0), 0, -Math.cos(a0)];
    const n1 = [-Math.sin(a1), 0, -Math.cos(a1)];
    quad(P(ri, a1, 0), P(ri, a0, 0), P(ri, a0, h), P(ri, a1, h), n1, n0, n0, n1);
    const up = [0, 1, 0];
    const down = [0, -1, 0];
    quad(P(ri, a0, h), P(r, a0, h), P(r, a1, h), P(ri, a1, h), up, up, up, up);
    quad(P(ri, a1, 0), P(r, a1, 0), P(r, a0, 0), P(ri, a0, 0), down, down, down, down);
  }
  const a0 = angle(0);
  const a1 = angle(segs);
  const s0 = [-Math.cos(a0), 0, Math.sin(a0)];
  const s1 = [Math.cos(a1), 0, -Math.sin(a1)];
  quad(P(r, a0, 0), P(r, a0, h), P(ri, a0, h), P(ri, a0, 0), s0, s0, s0, s0);
  quad(P(ri, a1, 0), P(ri, a1, h), P(r, a1, h), P(r, a1, 0), s1, s1, s1, s1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.addGroup(0, outer, 0);
  geo.addGroup(outer, pos.length / 3 - outer, 1);
  return geo;
}

// Relief i glasyren: avfasade kanter, en upphöjd ram och en rosett i mitten (normalkarta)
function makeReliefNormalMap(THREE) {
  const S = 256;
  const H = new Float32Array(S * S);
  const sm = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S;
      const v = (y + 0.5) / S;
      const edge = Math.min(u, 1 - u, v, 1 - v);
      const bevel = sm(0, 0.06, edge);
      const qx = Math.abs(u - 0.5) - 0.26;
      const qy = Math.abs(v - 0.5) - 0.26;
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.06;
      const ridge = Math.exp(-((d / 0.02) ** 2)) * 0.32;
      const rx = u - 0.5;
      const ry = v - 0.5;
      const r = Math.hypot(rx, ry);
      const th = Math.atan2(ry, rx);
      const petals = (0.5 + 0.5 * Math.cos(th * 8)) ** 2 * sm(0.2, 0.07, r) * 0.42;
      const dome = sm(0.07, 0, r) * 0.32;
      H[y * S + x] = bevel * 0.5 + ridge + petals + dome;
    }
  }
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(S, S);
  const at = (x, y) => H[clamp(y, 0, S - 1) * S + clamp(x, 0, S - 1)];
  const k = 9;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let nx = (at(x - 1, y) - at(x + 1, y)) * k;
      let ny = (at(x, y + 1) - at(x, y - 1)) * k;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * S + x) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// Tegel i halvstensförband med fogar
function makeBrickTexture(THREE) {
  const W = 512;
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b9a58f";
  ctx.fillRect(0, 0, W, W);
  const tones = ["#8a3b24", "#9b4a2c", "#7a3420", "#a65a36", "#8f4128", "#6f2f1d"];
  const bh = 32;
  const bw = 96;
  for (let row = 0; row < W / bh; row++) {
    const shift = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < W + bw; x += bw) {
      ctx.fillStyle = tones[(row * 7 + Math.floor((x + shift) / bw) * 3 + 11) % tones.length];
      ctx.fillRect(x + shift + 3, row * bh + 3, bw - 6, bh - 6);
    }
  }
  for (let i = 0; i < 2400; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,230,200"},${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * W, Math.random() * W, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3.4);
  return tex;
}

function makeGlowTexture(THREE, [r, g, b]) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShadowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.75)");
  grad.addColorStop(0.32, "rgba(0,0,0,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Ett litet "rum" med ljuskällor som glasyren och mässingen kan spegla
function makeEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 12), new THREE.MeshBasicMaterial({ color: 0x1d1814, side: THREE.BackSide }));
  room.position.y = 3;
  env.add(room);
  const panel = (w, h, color, strength, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 1, 0);
    env.add(m);
  };
  panel(3, 2.2, 0xfff0dd, 6, -4, 4, 4);
  panel(2, 3, 0xbfd2ff, 3, 4.5, 3, -3);
  panel(6, 1, 0xffe9d2, 2, 0, 6.5, 0);
  panel(1.5, 1.2, 0xff8a3d, 1.2, 0, 0.6, 3);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return tex;
}

// Lågor: brus som rör sig uppåt, smalare mot toppen, vitgul kärna
const FLAME_FRAGMENT = `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    vec2 uv = vUv;
    float n = noise(vec2(uv.x * 4.0 + uSeed, uv.y * 3.0 - uTime * 2.4)) * 0.6
            + noise(vec2(uv.x * 9.0 - uSeed, uv.y * 7.0 - uTime * 3.6)) * 0.3;
    float x = (uv.x - 0.5) * 2.0 + (n - 0.45) * 0.5 * uv.y;
    float width = 0.85 - uv.y * 0.72;
    float shape = 1.0 - smoothstep(0.0, 1.0, abs(x) / max(width, 0.05));
    float fade = smoothstep(1.0, 0.2, uv.y + n * 0.35) * smoothstep(0.0, 0.1, uv.y);
    float f = clamp(shape * fade, 0.0, 1.0);
    vec3 col = mix(vec3(0.9, 0.2, 0.03), vec3(1.0, 0.62, 0.2), smoothstep(0.1, 0.6, f));
    col = mix(col, vec3(1.0, 0.92, 0.72), smoothstep(0.6, 0.95, f));
    gl_FragColor = vec4(col * 1.7 * uIntensity, f * uIntensity);
  }
`;

// Värmens väg genom kanalerna: ritas fram längs banan, med pulser som rör sig mot skorstenen
const FLOW_FRAGMENT = `
  uniform float uTime;
  uniform float uFlow;
  varying vec2 vUv;
  void main() {
    float t = vUv.x;
    float head = uFlow * 1.08;
    float shown = smoothstep(head, head - 0.05, t);
    float pulse = pow(0.5 + 0.5 * sin(t * 26.0 - uTime * 2.4), 6.0);
    float heat = 1.0 - t * 0.7;
    vec3 col = mix(vec3(0.7, 0.12, 0.03), vec3(1.0, 0.72, 0.3), heat * 0.65 + pulse * 0.35);
    float alpha = shown * (0.3 + 0.7 * pulse) * (0.5 + 0.5 * heat);
    gl_FragColor = vec4(col * (1.1 + pulse * 1.6), alpha);
  }
`;

// Start när alla hjälpfunktioner ovan är definierade
if (section) init();
