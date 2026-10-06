// Rörelse: scrollstyrda effekter. Rubriker som reser sig ord för ord, räknare, parallax i hero
// och bilder, kort som staplas, citat som tänds medan man läser och knappar som dras mot pekaren.
// Inget av detta körs vid reducerad rörelse; sidan syns och fungerar fullt ut ändå.
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // Rubriker delas i ord så att de kan resa sig ett i taget (CSS sköter animationen)
  document.querySelectorAll("[data-reveal] h2").forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.textContent = "";
    words.forEach((word, i) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "sw";
      inner.style.setProperty("--w", i);
      inner.textContent = word;
      outer.append(inner);
      h.append(outer, i < words.length - 1 ? " " : "");
    });
  });

  // Räknare: "13 år" räknas upp när den syns
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    el.textContent = "0";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (now) => {
          const p = Math.min((now - t0) / 1600, 1);
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
  });

  // Citatet: orden tänds ett efter ett medan man scrollar förbi
  const quote = document.querySelector("[data-words]");
  let quoteWords = [];
  let lit = -1;
  if (quote) {
    const words = quote.textContent.trim().split(/\s+/);
    quote.textContent = "";
    words.forEach((word, i) => {
      const span = document.createElement("span");
      span.className = "qw";
      span.textContent = word;
      quote.append(span, i < words.length - 1 ? " " : "");
    });
    quote.classList.add("words-on");
    quoteWords = [...quote.querySelectorAll(".qw")];
  }

  const stage = document.querySelector(".hero__stage");
  const media = stage && stage.querySelector(".hero__media");
  const heroText = stage && stage.querySelector(".hero__text");
  const cards = [...document.querySelectorAll(".service")];
  const drifters = [...document.querySelectorAll(".work__frame, .about__visual .arch")];
  let stacking = false;
  let ticking = false;

  const measure = () => {
    stacking = cards.length > 1 && getComputedStyle(cards[0]).position === "sticky";
    if (!stacking) cards.forEach((c) => { c.style.scale = ""; c.style.setProperty("--dim", "0"); });
  };

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;

    // Hero: filmen rör sig långsammare än sidan, texten lyfter och tonar bort
    if (stage && media && heroText) {
      const h = stage.offsetHeight;
      if (y <= h) {
        media.style.translate = `0 ${(y * 0.35).toFixed(1)}px`;
        heroText.style.translate = `0 ${(y * -0.12).toFixed(1)}px`;
        heroText.style.opacity = String(clamp(1 - y / (h * 0.75), 0, 1));
      }
    }

    // Tjänster: kortet under krymper och mörknar när nästa lägger sig över
    if (stacking) {
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const top = card.getBoundingClientRect().top;
        const p = clamp((top + card.offsetHeight - next.getBoundingClientRect().top) / card.offsetHeight, 0, 1);
        card.style.scale = (1 - p * 0.06).toFixed(4);
        card.style.setProperty("--dim", (p * 0.3).toFixed(3));
      });
    }

    // Bilder som glider i sina ramar (--p från 0 när de kommer in till 1 när de lämnar)
    drifters.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) return;
      el.style.setProperty("--p", clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(3));
    });

    // Citatet tänds från 85 % till 40 % av skärmhöjden
    if (quoteWords.length) {
      const r = quote.getBoundingClientRect();
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.45), 0, 1);
      const count = Math.round(p * quoteWords.length);
      if (count !== lit) {
        quoteWords.forEach((w, i) => w.classList.toggle("is-lit", i < count));
        lit = count;
      }
    }
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    request();
  });
  measure();
  update();

  // Knappar dras lätt mot muspekaren
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".hero .btn, .about__cta .btn, .form .btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        btn.style.translate = `${(x * 6).toFixed(1)}px ${(y * 5).toFixed(1)}px`;
      });
      btn.addEventListener("pointerleave", () => {
        btn.style.translate = "";
      });
    });
  }
})();
