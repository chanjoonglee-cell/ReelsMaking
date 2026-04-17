const SESSION_ID = window.SESSION_ID;

let easymde;
let sections = [];
let sessionImages = [];
let saveTimer = null;

async function loadSession() {
  const resp = await fetch(`/api/sessions/${SESSION_ID}`);
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  sections = data.sections || [];
  sessionImages = data.images || [];
  document.getElementById("title").textContent = data.meta.title || SESSION_ID;
  return data;
}

// Rewrite relative image URLs in markdown so the preview (which runs at
// /editor/{id}) can fetch them from the session image endpoint.
function rewriteImageUrls(markdown) {
  return markdown.replace(
    /!\[([^\]]*)\]\(images\/([^)]+)\)/g,
    (_m, alt, name) => `![${alt}](/api/sessions/${SESSION_ID}/images/${name})`,
  );
}

function mount(initialMarkdown) {
  easymde = new EasyMDE({
    element: document.getElementById("editor"),
    initialValue: initialMarkdown,
    spellChecker: false,
    autofocus: true,
    sideBySideFullscreen: false,
    toolbar: [
      "bold", "italic", "heading", "|",
      "quote", "unordered-list", "ordered-list", "table", "|",
      "preview", "side-by-side", "|",
      "guide",
    ],
    previewRender: (plain) => marked.parse(rewriteImageUrls(plain), { breaks: true }),
    status: ["lines", "words", "cursor"],
  });
  // Force side-by-side view for split pane feel.
  easymde.toggleSideBySide();
  easymde.codemirror.on("change", markDirty);
}

function markDirty() {
  document.getElementById("save-status").textContent = "저장 중…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
}

async function save() {
  const markdown = easymde.value();
  const resp = await fetch(`/api/sessions/${SESSION_ID}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown }),
  });
  document.getElementById("save-status").textContent = resp.ok ? "저장됨" : "저장 실패";
}

function renderSectionList() {
  const ul = document.getElementById("section-list");
  ul.innerHTML = "";
  sections.forEach((s, i) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "4px";

    const btn = document.createElement("button");
    btn.textContent = s.title;
    btn.onclick = () => jumpToSection(s.title);

    const regen = document.createElement("button");
    regen.className = "regen";
    regen.textContent = "↻";
    regen.title = "이 섹션만 다시 생성";
    regen.onclick = () => regenerate(i);

    li.appendChild(btn);
    li.appendChild(regen);
    ul.appendChild(li);
  });
}

function jumpToSection(title) {
  const cm = easymde.codemirror;
  const needle = `## ${title}`;
  for (let i = 0; i < cm.lineCount(); i++) {
    if (cm.getLine(i).trim() === needle) {
      cm.setCursor({ line: i, ch: 0 });
      cm.scrollIntoView({ line: i, ch: 0 }, 100);
      cm.focus();
      return;
    }
  }
}

async function regenerate(index) {
  if (!confirm(`"${sections[index].title}" 섹션을 다시 생성할까요?`)) return;

  const banner = document.getElementById("regen-banner");
  const bannerText = document.getElementById("regen-banner-text");
  bannerText.textContent = `재생성 중: ${sections[index].title}`;
  banner.classList.remove("hidden");

  const regenButtons = document.querySelectorAll("#section-list .regen");
  regenButtons.forEach((b) => (b.disabled = true));
  document.getElementById("save-status").textContent = "재생성 중…";

  try {
    const resp = await fetch(`/api/sessions/${SESSION_ID}/sections/${index}/regenerate`, { method: "POST" });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    sections[index].content = data.content;
    easymde.value(data.draft);
    document.getElementById("save-status").textContent = "저장됨";
  } catch (e) {
    alert("재생성 실패: " + e.message);
  } finally {
    banner.classList.add("hidden");
    regenButtons.forEach((b) => (b.disabled = false));
  }
}

document.querySelectorAll(".btn-export").forEach((btn) => {
  btn.addEventListener("click", async () => {
    await save();
    const fmt = btn.dataset.fmt;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = `<span class="export-spinner"></span> ${fmt.toUpperCase()}…`;
    try {
      const url = `/api/sessions/${SESSION_ID}/export/${fmt}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        alert(`${fmt.toUpperCase()} 내보내기 실패:\n\n${err.error || resp.statusText}`);
        return;
      }
      const blob = await resp.blob();
      const disposition = resp.headers.get("content-disposition") || "";
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
      const filename = match ? decodeURIComponent(match[1]) : `proposal.${fmt}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
});

function renderImageList() {
  const ul = document.getElementById("image-list");
  ul.innerHTML = "";
  if (!sessionImages.length) {
    const li = document.createElement("li");
    li.className = "col-span-2 text-xs text-slate-400";
    li.textContent = "(이미지 없음)";
    ul.appendChild(li);
    return;
  }
  sessionImages.forEach((img) => {
    const li = document.createElement("li");
    li.className = "image-tile";
    li.title = img.caption || img.filename;
    li.innerHTML = `
      <img src="/api/sessions/${SESSION_ID}/images/${img.filename}" alt="${img.caption || ""}">
      <div class="image-tile-caption">${img.caption || img.filename}</div>
    `;
    li.onclick = () => insertImage(img);
    ul.appendChild(li);
  });
}

function insertImage(img) {
  const cm = easymde.codemirror;
  const cursor = cm.getCursor();
  const alt = (img.caption || img.filename).replace(/[\[\]]/g, "");
  const md = `\n\n![${alt}](images/${img.filename})\n\n`;
  cm.replaceRange(md, cursor);
  cm.focus();
  markDirty();
}

(async () => {
  try {
    const data = await loadSession();
    mount(data.draft || "");
    renderSectionList();
    renderImageList();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:2rem">세션 로드 실패: ${e.message}</div>`;
  }
})();
