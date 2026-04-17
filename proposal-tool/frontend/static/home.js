const state = { sources: [], templates: [] };

function setupDropzone(dz) {
  const kind = dz.dataset.kind;
  const input = dz.querySelector("input[type=file]");
  const list = dz.querySelector(".file-list");

  const onFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    state[kind].push(...files);
    render();
  };

  dz.addEventListener("click", (e) => {
    if (e.target.tagName !== "INPUT") input.click();
  });
  input.addEventListener("change", (e) => onFiles(e.target.files));
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("dragover");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("dragover");
    onFiles(e.dataTransfer.files);
  });

  function render() {
    list.innerHTML = "";
    state[kind].forEach((f, i) => {
      const li = document.createElement("li");
      li.textContent = `📄 ${f.name}`;
      const rm = document.createElement("button");
      rm.textContent = " ×";
      rm.style.color = "#94a3b8";
      rm.style.background = "none";
      rm.style.border = "none";
      rm.style.cursor = "pointer";
      rm.onclick = () => {
        state[kind].splice(i, 1);
        render();
      };
      li.appendChild(rm);
      list.appendChild(li);
    });
    dz.classList.toggle("has-files", state[kind].length > 0);
  }
}

document.querySelectorAll(".dropzone").forEach(setupDropzone);

document.getElementById("btn-generate").addEventListener("click", async () => {
  if (!state.sources.length || !state.templates.length) {
    alert("원본과 양식 파일을 모두 업로드해 주세요.");
    return;
  }
  const btn = document.getElementById("btn-generate");
  btn.disabled = true;
  btn.textContent = "업로드 중…";

  const fd = new FormData();
  state.sources.forEach((f) => fd.append("sources", f));
  state.templates.forEach((f) => fd.append("templates", f));
  fd.append("name", document.getElementById("name").value);

  let sessionId;
  try {
    const resp = await fetch("/api/sessions", { method: "POST", body: fd });
    if (!resp.ok) throw new Error(await resp.text());
    ({ session_id: sessionId } = await resp.json());
  } catch (e) {
    alert("업로드 실패: " + e.message);
    btn.disabled = false;
    btn.textContent = "초안 생성하기 →";
    return;
  }

  document.getElementById("progress").classList.remove("hidden");
  const log = document.getElementById("progress-log");
  const bar = document.getElementById("progress-bar");

  const push = (msg) => {
    const div = document.createElement("div");
    div.textContent = msg;
    log.appendChild(div);
  };

  push("세션 생성됨: " + sessionId);

  const es = new EventSource(`/api/sessions/${sessionId}/stream`);
  es.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.stage === "parse_files") push("업로드한 파일 파싱 중…");
    else if (data.stage === "parse_template") push("양식 파싱 중…");
    else if (data.stage === "outline_ready") push(`섹션 ${data.sections.length}개 발견`);
    else if (data.stage === "section_start") push(`  섹션 ${data.index + 1} 생성 시작: ${data.title}`);
    else if (data.stage === "section_done") {
      push(`  ✓ ${data.done}/${data.total} 완료`);
      bar.style.width = `${Math.round((data.done / data.total) * 100)}%`;
    } else if (data.stage === "done") {
      push("모두 완료! 편집기로 이동 중…");
      es.close();
      setTimeout(() => { window.location.href = `/editor/${sessionId}`; }, 600);
    } else if (data.stage === "error") {
      push("오류: " + data.message);
      es.close();
      btn.disabled = false;
      btn.textContent = "초안 생성하기 →";
    }
  };
});
