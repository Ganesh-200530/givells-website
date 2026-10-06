// Givells — landningssida

// Intro: valvet ritas och kakelugnen byggs (CSS). Här styrs förlopp och utgång:
// när sidan har laddat öppnas valvets inre båge och växer tills den täcker skärmen.
(() => {
  const root = document.documentElement;
  const loader = document.querySelector(".loader");
  if (!loader) return;
  if (!root.classList.contains("is-loading")) {
    loader.remove();
    return;
  }

  const MIN_MS = 1900; // låt teckningen hinna bli klar
  const MAX_MS = 7000; // håll aldrig kvar besökaren längre än så här
  const start = performance.now();
  const bar = loader.querySelector(".loader__bar span");
  const pct = loader.querySelector(".loader__pct");
  const mark = loader.querySelector(".loader__mark");
  const curtain = loader.querySelector(".loader__curtain");
  const curtainPath = loader.querySelector(".loader__curtain-path");
  let loaded = document.readyState === "complete";
  let shown = 0;
  let leaving = false;

  window.addEventListener("load", () => { loaded = true; }, { once: true });

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const tween = (ms, ease, onFrame) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / ms, 1);
        onFrame(ease(p));
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });

  const onKey = (e) => {
    if (e.key === "Escape") leave(true);
  };

  const leave = async (fast) => {
    if (leaving) return;
    leaving = true;
    document.removeEventListener("keydown", onKey);

    // Reservtimern i <head> kan redan ha släppt in besökaren
    if (!root.classList.contains("is-loading")) {
      loader.remove();
      return;
    }

    // Valvets inre öppning i skärmkoordinater (märkets viewBox är 0 0 200 232)
    const box = mark.getBoundingClientRect();
    const k = box.width / 200;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = box.left + 100 * k;
    const cy = box.top + 136 * k; // öppningens mitt, valvet växer härifrån
    const half = 58 * k;
    const spring = box.top + 108 * k;
    const base = box.top + 222 * k;
    const S = 1.1 * Math.max(cy / (cy - spring), (H - cy) / (base - cy), cx / half, (W - cx) / half);

    // Svart duk med ett valvformat hål (evenodd), skalat s gånger runt öppningens mitt
    const draw = (s) => {
      s = Math.max(s, 0.001);
      const l = cx - half * s;
      const r = cx + half * s;
      const sy = cy + (spring - cy) * s;
      const by = cy + (base - cy) * s;
      const rad = half * s;
      curtainPath.setAttribute("d", `M0 0H${W}V${H}H0Z M${l} ${by}V${sy}A${rad} ${rad} 0 0 1 ${r} ${sy}V${by}Z`);
    };

    curtain.setAttribute("viewBox", `0 0 ${W} ${H}`);
    draw(0);
    root.style.setProperty("--hero-base", fast ? "150ms" : "420ms");
    loader.classList.add("is-leaving");
    root.classList.add("is-ready");
    document.dispatchEvent(new Event("givells:reveal"));

    // 1. Kakelugn och text tonar bort, 2. dörröppningen blir genomsiktlig, 3. vi går in genom valvet
    await wait(fast ? 80 : 240);
    await tween(fast ? 220 : 420, easeOut, (p) => draw(p));
    await tween(fast ? 600 : 950, easeInOut, (p) => {
      const s = Math.pow(S, p);
      draw(s);
      mark.style.transform = `scale(${Math.min(s, 10)})`;
      mark.style.opacity = String(Math.max(0, 1 - p * 2.4));
    });

    root.classList.remove("is-loading");
    loader.remove();
  };

  const tick = (now) => {
    if (leaving) return;
    const elapsed = now - start;
    if (elapsed > MAX_MS) loaded = true;
    const timeP = Math.min(elapsed / MIN_MS, 1);
    const target = loaded ? timeP : Math.min(timeP, 0.9);
    shown += (target - shown) * 0.14;
    if (Math.abs(target - shown) < 0.003) shown = target;
    bar.style.transform = `scaleX(${shown})`;
    pct.textContent = `${Math.round(shown * 100)}%`;
    if (shown >= 1) leave(false);
    else requestAnimationFrame(tick);
  };

  document.addEventListener("keydown", onKey);
  requestAnimationFrame(tick);
})();

// Mörkt/ljust läge. Valet sparas; utan eget val följer sidan enhetens inställning.
// Bytet sveper ut i en cirkel från knappen där webbläsaren stöder View Transitions.
(() => {
  const root = document.documentElement;
  const button = document.querySelector(".theme-toggle");
  const meta = document.querySelector('meta[name="theme-color"]');
  const system = matchMedia("(prefers-color-scheme: light)");

  const apply = (theme) => {
    root.dataset.theme = theme;
    if (meta) meta.content = theme === "light" ? "#f5f6f3" : "#14110e";
    if (button) button.setAttribute("aria-label", theme === "light" ? "Byt till mörkt läge" : "Byt till ljust läge");
    document.dispatchEvent(new CustomEvent("givells:theme", { detail: theme }));
  };

  apply(root.dataset.theme === "light" ? "light" : "dark");

  system.addEventListener("change", (e) => {
    let saved = null;
    try { saved = localStorage.getItem("givells-theme"); } catch {}
    if (!saved) apply(e.matches ? "light" : "dark");
  });

  if (!button) return;
  button.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    try { localStorage.setItem("givells-theme", next); } catch {}
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce) {
      apply(next);
      return;
    }
    const r = button.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => apply(next));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 750, easing: "cubic-bezier(0.7, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
  });
})();

// Sidhuvud: följer scrollen exakt. De första 160 pixlarna formar det om till en flytande ö
// (--hp), glaset tonas in strax före (--hb). Över filmen används mörka färger (.is-over-dark).
// Den tunna linjen visar hur långt ner på sidan man har kommit.
(() => {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const root = document.documentElement;
  const stage = document.querySelector(".hero__stage");
  const RANGE = 160;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = Math.max(window.scrollY, 0);
    const max = root.scrollHeight - window.innerHeight;
    const hp = Math.min(y / RANGE, 1);
    const hb = Math.min(Math.max((y / RANGE - 0.05) * 1.6, 0), 1);
    header.style.setProperty("--hp", hp.toFixed(3));
    header.style.setProperty("--hb", hb.toFixed(3));
    header.classList.toggle("is-docked", hp >= 1);
    header.classList.toggle("is-over-dark", stage ? stage.getBoundingClientRect().bottom > 64 : false);
    header.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : "0");
  };
  window.addEventListener("resize", () => requestAnimationFrame(update));

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
})();

// Menyn: en glödpunkt glider till länken för den del av sidan man är i
(() => {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const dot = nav.querySelector(".site-nav__indicator");
  const sections = new Map(links.map((a) => [document.querySelector(a.getAttribute("href")), a]));
  const inBand = new Set();

  const setActive = (link) => {
    links.forEach((a) => (a === link ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    if (!dot) return;
    if (!link) {
      dot.classList.remove("is-on");
      return;
    }
    dot.style.setProperty("--x", `${link.offsetLeft + link.offsetWidth / 2 - dot.offsetWidth / 2}px`);
    dot.classList.add("is-on");
  };

  // Aktiv är den sektion som korsar ett smalt band strax ovanför skärmens mitt
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target)));
      const active = [...sections.keys()].find((s) => inBand.has(s));
      setActive(active ? sections.get(active) : null);
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((_, section) => section && io.observe(section));
})();

// Mobilmenyn: öppnas som ett valv, låser sidan bakom och stängs med länk, kryss eller Esc
(() => {
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("meny");
  const header = document.querySelector(".site-header");
  if (!toggle || !menu || !header) return;
  const root = document.documentElement;
  const label = toggle.querySelector(".visually-hidden");
  const behind = [document.getElementById("main"), document.querySelector(".site-footer"), header.querySelector(".btn--pulse")];

  const setOpen = (open) => {
    menu.classList.toggle("is-open", open);
    menu.inert = !open;
    toggle.setAttribute("aria-expanded", String(open));
    label.textContent = open ? "Stäng menyn" : "Meny";
    root.classList.toggle("menu-open", open);
    header.classList.toggle("is-menu-open", open);
    behind.forEach((el) => el && (el.inert = open));
    if (open) menu.querySelector("a").focus({ preventScroll: true });
  };

  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !menu.classList.contains("is-open")) return;
    setOpen(false);
    toggle.focus();
  });
  // Stäng om skärmen blir så bred att den vanliga menyn visas
  matchMedia("(min-width: 1101px)").addEventListener("change", (e) => {
    if (e.matches && menu.classList.contains("is-open")) setOpen(false);
  });
})();

// Bakgrundsfilm i hero: film efter skärmens orientering, startar när valvet öppnas,
// mjuk övertoning i loopen och paus när den inte syns.
// Vid reducerad rörelse eller datasparläge visas bara affischbilden.
(() => {
  const stage = document.querySelector(".hero__stage");
  const videos = stage ? [...stage.querySelectorAll(".hero__video")] : [];
  if (videos.length !== 2) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData) return;

  const root = document.documentElement;
  const portrait = matchMedia("(orientation: portrait)");
  const FADE = 1.2; // sekunder, samma som övergången i CSS
  const { srcLandscape, srcPortrait } = videos[0].dataset;
  let active = 0;
  let fading = false;
  let started = false;
  let visible = true;

  const play = (v) => v.play().catch(() => {}); // t.ex. strömsparläge i iOS: affischen ligger kvar

  const load = () => {
    const src = portrait.matches ? srcPortrait : srcLandscape;
    videos.forEach((v) => {
      v.preload = "auto";
      v.src = src;
    });
  };

  // När filmen närmar sig slutet startar den andra från början och tonas in över den
  const crossfade = (i) => {
    if (i !== active || fading) return;
    fading = true;
    const current = videos[i];
    const next = videos[1 - i];
    next.currentTime = 0;
    play(next);
    next.classList.add("is-active");
    current.classList.remove("is-active");
    active = 1 - i;
    setTimeout(() => {
      current.pause();
      fading = false;
    }, FADE * 1000);
  };

  videos.forEach((v, i) => {
    v.addEventListener("timeupdate", () => {
      if (v.duration && v.duration - v.currentTime <= FADE) crossfade(i);
    });
    v.addEventListener("ended", () => crossfade(i));
  });

  const start = () => {
    if (started) return;
    started = true;
    if (visible) play(videos[active]);
  };

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!started) return;
    if (visible) play(videos[active]);
    else videos.forEach((v) => v.pause());
  }).observe(stage);

  portrait.addEventListener("change", () => {
    videos.forEach((v) => v.pause());
    active = 0;
    fading = false;
    videos[0].classList.add("is-active");
    videos[1].classList.remove("is-active");
    load();
    if (started && visible) play(videos[0]);
  });

  load();
  if (root.classList.contains("is-loading")) {
    document.addEventListener("givells:reveal", start, { once: true });
    setTimeout(start, 9500); // reserv om introt inte avslutas som vanligt
  } else {
    start();
  }
})();

// Sektioner glider in när de kommer in i bild
(() => {
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("reveal-on");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
})();

// Tjänsterna: snabbval som hoppar till rätt kort och visar vilket kort man är på.
// Stora skärmar: korten staplas när man scrollar. Telefon/surfplatta: en svepbar karusell där valen är flikar.
(() => {
  const cards = [...document.querySelectorAll(".service")];
  const links = [...document.querySelectorAll(".service-jump a")];
  if (!cards.length || !links.length) return;
  const list = cards[0].parentElement;
  const section = list.closest("section");
  const smooth = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  const sticky = () => getComputedStyle(cards[0]).position === "sticky";
  const carousel = () => getComputedStyle(list).overflowX === "auto";
  const stickTop = (card) => parseFloat(getComputedStyle(card).top) || 0;
  const gap = () => parseFloat(getComputedStyle(list).rowGap) || 0;

  // Kortets plats i flödet, som om korten inte låg fast
  const naturalTop = (i) => {
    let y = list.getBoundingClientRect().top + window.scrollY;
    for (let k = 0; k < i; k++) y += cards[k].offsetHeight + gap();
    return y;
  };

  const setActive = (active) =>
    links.forEach((a, i) => (i === active ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));

  links.forEach((a, i) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (carousel()) {
        list.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: smooth });
        setActive(i);
        return;
      }
      const top = naturalTop(i) - (sticky() ? stickTop(cards[i]) : 96);
      window.scrollTo({ top: top + 2, behavior: smooth });
    });
  });

  let ticking = false;
  const update = () => {
    ticking = false;
    if (carousel()) {
      const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 1;
      setActive(Math.min(cards.length - 1, Math.round(list.scrollLeft / step)));
      return;
    }
    const s = section.getBoundingClientRect();
    const vh = window.innerHeight;
    let active = -1;
    if (s.top < vh * 0.6 && s.bottom > vh * 0.35) {
      active = 0;
      const isSticky = sticky();
      cards.forEach((c, i) => {
        const top = c.getBoundingClientRect().top;
        if (isSticky ? top <= stickTop(c) + 6 : top <= vh * 0.45) active = i;
      });
    }
    setActive(active);
  };
  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  list.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request);
  update();
})();

// Galleriet i Arbeten: pilar, räknare, förloppslinje och dra med musen (svep fungerar som vanligt)
(() => {
  const track = document.querySelector(".slider__track");
  if (!track) return;
  const items = [...track.querySelectorAll(".work")];
  const fill = document.querySelector(".slider__progress span");
  const count = document.querySelector(".slider__count b");
  const [prev, next] = document.querySelectorAll(".slider__btn");
  const smooth = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

  const step = () => (items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth);
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    const p = max > 0 ? track.scrollLeft / max : 1;
    const visible = track.clientWidth / track.scrollWidth;
    fill.style.setProperty("--fill", (visible + (1 - visible) * p).toFixed(3));
    const index = Math.min(items.length, Math.round(track.scrollLeft / step()) + 1);
    count.textContent = String(index).padStart(2, "0");
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
  };
  const page = (dir) => {
    const perView = Math.max(1, Math.floor(track.clientWidth / step()) - 1);
    track.scrollBy({ left: dir * step() * perView, behavior: smooth });
  };
  prev.addEventListener("click", () => page(-1));
  next.addEventListener("click", () => page(1));
  track.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();

  // Dra med musen; ett drag öppnar inte bildvisningen
  let down = false;
  let moved = false;
  let startX = 0;
  let startLeft = 0;
  track.querySelectorAll("img").forEach((img) => (img.draggable = false));
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true;
    moved = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      track.classList.add("is-dragging");
    }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    if (!moved) return;
    track.classList.remove("is-dragging");
    track.scrollTo({ left: Math.round(track.scrollLeft / step()) * step(), behavior: smooth });
  });
  track.addEventListener("click", (e) => {
    if (!moved) return;
    e.preventDefault();
    e.stopPropagation();
    moved = false;
  }, true);
})();

// Bilderna i Arbeten lutar lätt mot muspekaren (bara med mus, inte vid reducerad rörelse)
(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll(".work").forEach((card) => {
    const frame = card.querySelector(".work__frame");
    card.addEventListener("pointermove", (e) => {
      const r = frame.getBoundingClientRect();
      const px = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) - 0.5;
      const py = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1) - 0.5;
      card.classList.add("is-tilting");
      frame.style.transform = `rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) scale(1.03)`;
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("is-tilting");
      frame.style.transform = "";
    });
  });
})();

// Aktuellt år i sidfoten
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Tjänstelänkar förväljer ämne i formuläret
const topicSelect = document.getElementById("amne");
document.querySelectorAll("[data-topic]").forEach((link) => {
  link.addEventListener("click", () => {
    if (topicSelect) topicSelect.value = link.dataset.topic;
  });
});

// Bildvisning för utvalda arbeten
(() => {
  const dialog = document.querySelector(".lightbox");
  const items = [...document.querySelectorAll("[data-lightbox]")];
  if (!dialog || !items.length || typeof dialog.showModal !== "function") return;

  const img = dialog.querySelector(".lightbox__img");
  const cap = dialog.querySelector(".lightbox__cap");
  let index = 0;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    img.src = item.getAttribute("href");
    img.alt = item.querySelector("img").alt;
    cap.textContent = `${item.dataset.caption} · ${index + 1} av ${items.length}`;
  };

  items.forEach((item, i) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      show(i);
      dialog.showModal();
    });
  });

  dialog.querySelector(".lightbox__close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".lightbox__prev").addEventListener("click", () => show(index - 1));
  dialog.querySelector(".lightbox__next").addEventListener("click", () => show(index + 1));
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
})();

// Telefon: offertformuläret öppnas som en panel nerifrån. Formuläret flyttas in i panelen och
// tillbaka när den stängs. Stängs med krysset, Esc, ett tryck utanför eller genom att dra panelen nedåt.
(() => {
  const sheet = document.getElementById("offert");
  const form = document.getElementById("offertformular");
  const home = document.querySelector(".form-home");
  if (!sheet || !form || !home || typeof sheet.showModal !== "function") return;
  const body = sheet.querySelector(".sheet__body");
  const panel = sheet.querySelector(".sheet__panel");
  const root = document.documentElement;
  const phone = matchMedia("(max-width: 860px)");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const topic = document.getElementById("amne");
  let closing = false;

  const open = (value) => {
    body.append(form);
    form.classList.add("is-visible");
    if (value && topic) topic.value = value;
    sheet.showModal();
    root.classList.add("sheet-open");
  };
  const close = () => {
    if (!sheet.open || closing) return;
    closing = true;
    panel.style.translate = "";
    sheet.classList.add("is-closing");
    setTimeout(() => sheet.close(), reduce ? 0 : 320);
  };
  sheet.addEventListener("close", () => {
    sheet.classList.remove("is-closing");
    panel.style.translate = "";
    home.after(form);
    root.classList.remove("sheet-open");
    closing = false;
  });
  sheet.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  sheet.querySelector(".sheet__close").addEventListener("click", close);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) close(); // tryck på bakgrunden
  });

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-offer]");
    if (!trigger || !phone.matches) return;
    e.preventDefault();
    open(trigger.dataset.topic);
  });
  phone.addEventListener("change", (e) => {
    if (!e.matches && sheet.open) sheet.close();
  });

  // Dra panelen nedåt för att stänga
  let startY = null;
  let dy = 0;
  sheet.querySelectorAll(".sheet__grab, .sheet__head").forEach((handle) => {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      startY = e.clientY;
      dy = 0;
      panel.style.transition = "none";
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      panel.style.translate = `0 ${dy}px`;
    });
    const end = () => {
      if (startY === null) return;
      startY = null;
      panel.style.transition = "";
      if (dy > 110) close();
      else panel.style.translate = "";
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
})();

// Telefon: snabbknapparna längst ned visas när hero-knapparna har scrollats förbi,
// men inte över 3D-kakelugnen, kontaktdelen eller sidfoten (som har egna knappar)
(() => {
  const bar = document.querySelector(".action-bar");
  const heroCta = document.querySelector(".hero__cta");
  if (!bar || !heroCta) return;
  const blockers = [...document.querySelectorAll("#kakelugnen, #kontakt, .site-footer")];
  const blocking = new Set();
  let pastHero = false;
  const update = () => bar.classList.toggle("is-on", pastHero && blocking.size === 0);

  new IntersectionObserver(([entry]) => {
    pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    update();
  }).observe(heroCta);
  // ett avsnitt räknas först när det når upp i övre två tredjedelar av skärmen
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? blocking.add(e.target) : blocking.delete(e.target)));
    update();
  }, { rootMargin: "0px 0px -35% 0px" });
  blockers.forEach((el) => io.observe(el));
})();

// Offertformulär: skickar till data-endpoint om den finns, annars via e-postprogrammet
(() => {
  const form = document.getElementById("offertformular");
  if (!form) return;

  const status = form.querySelector(".form__status");
  const button = form.querySelector('button[type="submit"]');

  const setStatus = (text, state = "ok") => {
    status.textContent = text;
    status.dataset.state = state;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (data.get("_gotcha")) return;

    const endpoint = form.dataset.endpoint;

    if (!endpoint) {
      const topic = data.get("amne") || "Allmänt";
      const lines = [
        `Namn: ${data.get("namn")}`,
        `Telefon: ${data.get("telefon")}`,
        `E-post: ${data.get("epost") || "–"}`,
        `Ort: ${data.get("ort") || "–"}`,
        `Gäller: ${topic}`,
        "",
        data.get("meddelande") || "",
      ];
      const subject = `Förfrågan via webbplatsen – ${topic}`;
      window.location.href =
        `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(lines.join("\n"))}`;
      setStatus("Ditt e-postprogram öppnas med förfrågan ifylld. Tryck på skicka där, eller ring 073-300 32 28.");
      return;
    }

    button.disabled = true;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(res.statusText);
      form.reset();
      setStatus("Tack! Din förfrågan är skickad. Vi hör av oss så snart vi kan.");
    } catch {
      setStatus("Något gick fel när förfrågan skulle skickas. Ring 073-300 32 28 eller mejla teodor@givellskakelugnsmakeri.se.", "error");
    } finally {
      button.disabled = false;
    }
  });
})();
