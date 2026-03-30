const asanaSection = document.getElementById("asana-section");
const sequenceSection = document.getElementById("sequence-section");

/* ---------- MARKED EXTENSION ---------- */

marked.use({
  extensions: [
    {
      name: "highlight",
      level: "inline",
      start(src) {
        return src.indexOf("==");
      },
      tokenizer(src) {
        const rule = /^==([^=]+)==/;
        const match = rule.exec(src);

        if (match) {
          return {
            type: "highlight",
            raw: match[0],
            text: match[1].trim(),
          };
        }
      },
      renderer(token) {
        return `<mark>${token.text}</mark>`;
      },
    },
  ],
});

/* ---------- INIT ---------- */

init();

async function init() {
  const [asanaMd, sequenceMd] = await Promise.all([
    fetch("/asana/asana.md").then((r) => r.text()),
    fetch("sequence.md")
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""),
  ]);

  asanaSection.innerHTML = marked.parse(asanaMd);
  makeH2Dropdowns();
  await inlineSvgImages(asanaSection);

  const imageMap = buildAsanaImageMap(asanaMd);

  if (sequenceMd.trim()) {
    buildSequenceSection(sequenceMd, imageMap);
    await inlineSvgImages(sequenceSection);
    wireSequenceClicks();
  }
}

/* ---------- HELPERS ---------- */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function normalizeTitle(text) {
  return text
    .toLowerCase()
    .replace(/—/g, "-")
    .replace(/-/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isImageParagraph(el) {
  return (
    el.tagName === "P" &&
    el.children.length === 1 &&
    el.firstElementChild &&
    el.firstElementChild.tagName === "IMG"
  );
}

/* ---------- ASANA DROPDOWNS ---------- */

function makeH2Dropdowns() {
  const elements = [...asanaSection.children];
  const fragment = document.createDocumentFragment();

  let currentH1Section = null;
  let currentDropdown = null;
  let currentText = null;
  let currentMedia = null;

  elements.forEach((el) => {
    if (el.tagName === "H1") {
      currentH1Section = document.createElement("section");
      currentH1Section.className = "h1-section";
      fragment.appendChild(currentH1Section);

      currentH1Section.appendChild(el);
      currentDropdown = null;
      return;
    }

    if (el.tagName === "H2") {
      const details = document.createElement("details");
      details.className = "h2-dropdown";

      const summary = document.createElement("summary");
      summary.textContent = el.textContent;
      summary.id = slugify(el.textContent);
      summary.dataset.poseKey = normalizeTitle(el.textContent);

      const body = document.createElement("div");
      body.className = "h2-body";

      const text = document.createElement("div");
      text.className = "h2-text";

      const media = document.createElement("div");
      media.className = "h2-media";

      body.appendChild(text);
      body.appendChild(media);

      details.appendChild(summary);
      details.appendChild(body);

      (currentH1Section || fragment).appendChild(details);

      currentDropdown = details;
      currentText = text;
      currentMedia = media;
      return;
    }

    if (currentDropdown) {
      if (isImageParagraph(el)) {
        currentMedia.appendChild(el);
      } else {
        currentText.appendChild(el);
      }
    }
  });

  asanaSection.innerHTML = "";
  asanaSection.appendChild(fragment);
}

/* ---------- IMAGE MAP ---------- */

function buildAsanaImageMap(asanaMd) {
  const map = new Map();
  const lines = asanaMd.split(/\r?\n/);

  let currentPose = null;

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      currentPose = h2Match[1].trim();
      continue;
    }

    const imgMatch = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (imgMatch && currentPose) {
      map.set(normalizeTitle(currentPose), imgMatch[1].trim());
    }
  }

  return map;
}

/* ---------- SEQUENCE ---------- */

function buildSequenceSection(sequenceMd, imageMap) {
  const container = document.createDocumentFragment();
  const lines = sequenceMd.split(/\r?\n/);

  let currentSequence = null;
  let currentRowsWrap = null;
  let currentRow = null;

  function ensureRow() {
    if (!currentRow) {
      currentRow = document.createElement("div");
      currentRow.className = "sequence-row";
      currentRowsWrap.appendChild(currentRow);
    }
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      currentRow = null;
      return;
    }

    const h1Match = line.match(/^#\s+(.*)$/);
    if (h1Match) {
      currentSequence = document.createElement("details");
      currentSequence.className = "sequence-dropdown";
      currentSequence.open = true;

      const summary = document.createElement("summary");
      summary.textContent = h1Match[1];

      currentRowsWrap = document.createElement("div");
      currentRowsWrap.className = "sequence-rows";

      currentSequence.appendChild(summary);
      currentSequence.appendChild(currentRowsWrap);
      container.appendChild(currentSequence);
      return;
    }

    const h2Match = line.match(/^##\s+(.*)$/);
    if (h2Match) {
      ensureRow();

      const poseName = h2Match[1];
      const key = normalizeTitle(poseName);
      const imgSrc = imageMap.get(key);

      const card = document.createElement("button");
      card.className = "sequence-pose";
      card.dataset.poseKey = key;

      const media = document.createElement("div");
      media.className = "sequence-pose-media";

      if (imgSrc) {
        const img = document.createElement("img");
        img.src = imgSrc;
        media.appendChild(img);
      } else {
        const missing = document.createElement("div");
        missing.className = "sequence-missing";
        missing.textContent = "✕";
        media.appendChild(missing);
      }

      const label = document.createElement("div");
      label.className = "sequence-pose-label";
      label.textContent = poseName;

      card.appendChild(media);
      card.appendChild(label);
      currentRow.appendChild(card);
    }
  });

  sequenceSection.innerHTML = "";
  sequenceSection.appendChild(container);
}

/* ---------- CLICK NAV ---------- */

function wireSequenceClicks() {
  document.querySelectorAll(".sequence-pose").forEach((card) => {
    card.onclick = () => {
      const key = card.dataset.poseKey;

      const target = document.querySelector(
        `summary[data-pose-key="${CSS.escape(key)}"]`
      );

      if (!target) return;

      target.closest("details").open = true;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };
  });
}

/* ---------- SVG INLINE ---------- */

async function inlineSvgImages(root = document) {
  const imgs = [...root.querySelectorAll('img[src$=".svg"]')];

  await Promise.all(
    imgs.map(async (img) => {
      const res = await fetch(img.src);
      const text = await res.text();

      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const svg = doc.documentElement;

      if (!svg) return;

      svg.classList.add("asana-svg");

      svg.querySelectorAll("path").forEach((p) => {
        if (!p.hasAttribute("fill")) {
          p.setAttribute("fill", "currentColor");
        }
      });

      img.replaceWith(svg);
    })
  );
}

/* ---------- THEME ---------- */

const btn = document.getElementById("theme-toggle");

btn.onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
};

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
}