import { app } from "../../scripts/app.js";

const FOLDER_OPTIONS = [
  { value: "checkpoints",      label: "Checkpoints" },
  { value: "loras",            label: "LoRA" },
  { value: "controlnet",       label: "ControlNet" },
  { value: "vae",              label: "VAE" },
  { value: "upscale_models",   label: "Upscaler" },
  { value: "clip",             label: "CLIP" },
  { value: "unet",             label: "UNet" },
  { value: "embeddings",       label: "Embeddings" },
  { value: "diffusion_models", label: "Diffusion Models" },
  { value: "text_encoders",    label: "Text Encoders" },
];

const PIPELINE_MAP = {
  checkpoints: "text-to-image",
  loras: "text-to-image",
  controlnet: "image-to-image",
};

const QUICK_TAGS   = ["", "flux", "sdxl", "sd 1.5", "controlnet", "lora", "upscale", "vae"];
const QUICK_LABELS = ["All", "FLUX", "SDXL", "SD 1.5", "ControlNet", "LoRA", "Upscale", "VAE"];

function guessFolder(model) {
  const id   = (model.id   || "").toLowerCase();
  const tags = (model.tags || []).join(" ").toLowerCase();
  if (tags.includes("lora")         || id.includes("lora"))          return "loras";
  if (tags.includes("controlnet")   || id.includes("controlnet"))    return "controlnet";
  if (tags.includes("vae")          || id.includes("-vae"))          return "vae";
  if (id.includes("upscal"))                                          return "upscale_models";
  if (tags.includes("clip")         || id.includes("clip"))          return "clip";
  if (tags.includes("text_encoder") || id.includes("text_encoder"))  return "text_encoders";
  if (tags.includes("diffusion")    || id.includes("diffusion"))     return "diffusion_models";
  return "checkpoints";
}

function fmtNum(n) {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + " KB";
  return bytes + " B";
}

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(e.style, v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

class HuggingHITPanel {
  constructor() {
    this.query = "";
    this.activeTag = "";
    this.results = [];
    this.searchTimer = null;
    this.searchInput = null;
    this.typeSelect = null;
    this.tokenInput = null;
    this.tagRow = null;
    this.tabs = null;
    this.resultsArea = null;
    this.installedArea = null;
    this.currentTab = 0;
    this.diskBar = null;
    this.diskLabel = null;
    this.diskFill = null;
  }

  buildPanel() {
    const root = el("div", {
      style: {
        display: "flex", flexDirection: "column", height: "100%",
        background: "var(--comfy-menu-bg, #1a1a1a)",
        color: "var(--input-text, #eee)",
        fontFamily: "sans-serif", fontSize: "13px", overflow: "hidden",
      }
    });

    const header = el("div", {
      style: {
        padding: "12px 14px 10px", borderBottom: "1px solid #333",
        display: "flex", alignItems: "center", gap: "8px", flexShrink: "0"
      }
    }, [
      el("span", { style: { fontSize: "20px" } }, ["🤗"]),
      el("span", { style: { fontWeight: "600", fontSize: "14px" } }, ["HuggingHIT"]),
    ]);

    // Disk Space Bar
    this.diskLabel = el("div", {
      style: {
        fontSize: "10px", color: "#888", marginBottom: "5px",
        display: "flex", justifyContent: "space-between"
      }
    }, [el("span", {}, ["💾 Loading disk info..."])]);

    this.diskFill = el("div", {
      style: {
        height: "4px", background: "#22c55e", width: "0%",
        borderRadius: "2px", transition: "width 0.5s, background 0.5s"
      }
    });

    const diskTrack = el("div", {
      style: { height: "4px", background: "#2a2a2a", borderRadius: "2px", overflow: "hidden" }
    }, [this.diskFill]);

    this.diskBar = el("div", {
      style: { padding: "8px 14px 8px", flexShrink: "0", borderBottom: "1px solid #2a2a2a" }
    }, [this.diskLabel, diskTrack]);

    this.searchInput = el("input", {
      type: "text",
      placeholder: "Search model... (flux, sdxl, lora...)",
      style: {
        width: "100%", padding: "7px 10px", borderRadius: "6px",
        border: "1px solid #444", background: "#2a2a2a",
        color: "#eee", fontSize: "13px", boxSizing: "border-box",
      },
      oninput: () => this.debounceSearch(),
    });

    this.typeSelect = el("select", {
      style: {
        width: "100%", padding: "6px 8px", borderRadius: "6px",
        border: "1px solid #444", background: "#2a2a2a",
        color: "#eee", fontSize: "12px", marginTop: "6px",
      },
      onchange: () => this.doSearch(),
    }, [
      el("option", { value: "" }, ["All Types"]),
      ...FOLDER_OPTIONS.map(f => el("option", { value: f.value }, [f.label]))
    ]);

    this.tokenInput = el("input", {
      type: "password",
      placeholder: "HuggingFace token (for gated models)",
      style: {
        width: "100%", padding: "6px 10px", borderRadius: "6px",
        border: "1px solid #444", background: "#2a2a2a",
        color: "#eee", fontSize: "12px", marginTop: "6px", boxSizing: "border-box",
      },
    });

    const searchArea = el("div", {
      style: { padding: "10px 14px 8px", flexShrink: "0" }
    }, [this.searchInput, this.typeSelect, this.tokenInput]);

    this.tagRow = el("div", {
      style: { display: "flex", flexWrap: "wrap", gap: "5px", padding: "0 14px 10px", flexShrink: "0" }
    });

    QUICK_TAGS.forEach((q, i) => {
      const tag = el("span", {
        style: {
          padding: "3px 9px", borderRadius: "12px", cursor: "pointer",
          border: "1px solid #444", fontSize: "11px",
          background: q === this.activeTag ? "#e07a00" : "#2a2a2a",
          color: q === this.activeTag ? "#fff" : "#aaa",
        },
        onclick: () => this.quickSearch(q, tag),
      }, [QUICK_LABELS[i]]);
      this.tagRow.appendChild(tag);
    });

    this.tabs = el("div", {
      style: { display: "flex", borderBottom: "1px solid #333", padding: "0 14px", flexShrink: "0" }
    });

    ["Search", "Installed"].forEach((label, i) => {
      const tab = el("span", {
        style: {
          padding: "6px 12px", cursor: "pointer", fontSize: "12px",
          borderBottom: i === 0 ? "2px solid #e07a00" : "2px solid transparent",
          color: i === 0 ? "#e07a00" : "#888", marginBottom: "-1px",
        },
        onclick: () => this.switchTab(i),
      }, [label]);
      tab.dataset.tab = i;
      this.tabs.appendChild(tab);
    });

    this.resultsArea   = el("div", { style: { flex: "1", overflowY: "auto", padding: "8px 14px" } });
    this.installedArea = el("div", { style: { flex: "1", overflowY: "auto", padding: "8px 14px", display: "none" } });

    root.appendChild(header);
    root.appendChild(this.diskBar);
    root.appendChild(searchArea);
    root.appendChild(this.tagRow);
    root.appendChild(this.tabs);
    root.appendChild(this.resultsArea);
    root.appendChild(this.installedArea);

    this.currentTab = 0;
    this.doSearch();
    this.loadInstalled();
    this.refreshDisk();
    return root;
  }

  async refreshDisk() {
    try {
      const res  = await fetch("/hh/diskspace");
      const data = await res.json();
      if (data.error) return;

      const { free, total, used } = data;
      const pct = Math.round(used / total * 100);

      this.diskLabel.innerHTML = "";
      this.diskLabel.appendChild(el("span", { style: { color: "#aaa" } }, ["💾 Free: " + fmtSize(free)]));
      this.diskLabel.appendChild(el("span", { style: { color: "#666" } }, [fmtSize(used) + " / " + fmtSize(total) + " (" + pct + "%)"]));

      this.diskFill.style.width      = pct + "%";
      this.diskFill.style.background = pct > 90 ? "#f87171" : pct > 75 ? "#e07a00" : "#22c55e";
    } catch {}
  }

  switchTab(idx) {
    this.currentTab = idx;
    this.tabs.querySelectorAll("span").forEach((t, i) => {
      t.style.borderBottom = i === idx ? "2px solid #e07a00" : "2px solid transparent";
      t.style.color        = i === idx ? "#e07a00" : "#888";
    });
    this.resultsArea.style.display   = idx === 0 ? "" : "none";
    this.installedArea.style.display = idx === 1 ? "" : "none";
    if (idx === 1) this.loadInstalled();
  }

  debounceSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.doSearch(), 500);
  }

  quickSearch(q, tagEl) {
    this.activeTag = q;
    this.tagRow.querySelectorAll("span").forEach(t => { t.style.background = "#2a2a2a"; t.style.color = "#aaa"; });
    tagEl.style.background = "#e07a00";
    tagEl.style.color = "#fff";
    this.searchInput.value = q;
    this.doSearch();
  }

  async doSearch() {
    this.query = this.searchInput.value.trim();
    const type     = this.typeSelect.value;
    const pipeline = PIPELINE_MAP[type] || "";

    this.resultsArea.innerHTML = `<div style="text-align:center;padding:2rem;color:#888">Searching HuggingFace...</div>`;

    try {
      let url = `/hh/search?limit=15&q=${encodeURIComponent(this.query)}`;
      if (pipeline) url += `&pipeline=${encodeURIComponent(pipeline)}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      this.results = data;
      this.renderResults();
    } catch (e) {
      this.resultsArea.innerHTML = `<div style="text-align:center;padding:2rem;color:#f87171">Error: ${e.message}</div>`;
    }
  }

  renderResults() {
    this.resultsArea.innerHTML = "";
    if (!this.results.length) {
      this.resultsArea.innerHTML = `<div style="text-align:center;padding:2rem;color:#888">No models found</div>`;
      return;
    }
    this.results.forEach(m => this.resultsArea.appendChild(this.buildModelCard(m)));
  }

  buildModelCard(m) {
    const modelId   = m.id || "";
    const shortName = modelId.split("/").pop() || modelId;
    const author    = modelId.split("/")[0] || "";

    const folderSelect = el("select", {
      style: {
        width: "100%", padding: "4px 6px", borderRadius: "5px",
        border: "1px solid #444", background: "#1e1e1e",
        color: "#ddd", fontSize: "11px", marginBottom: "6px",
      }
    }, FOLDER_OPTIONS.map(f =>
      el("option", { value: f.value, ...(f.value === guessFolder(m) ? { selected: "" } : {}) },
         [`${f.label} → models/${f.value}`])
    ));

    const fill = el("div", {
      style: { height: "100%", background: "#e07a00", width: "0%", transition: "width 0.4s", borderRadius: "2px" }
    });
    const progressBar = el("div", {
      style: { height: "6px", background: "#333", borderRadius: "3px", overflow: "hidden", marginBottom: "4px", display: "none" }
    }, [fill]);
    const statusLabel = el("div", { style: { fontSize: "11px", color: "#aaa", minHeight: "16px", marginBottom: "4px" } });

    const fileBrowser = el("div", {
      style: { display: "none", background: "#1a1a1a", border: "1px solid #444", borderRadius: "6px", marginBottom: "6px", overflow: "hidden" }
    });

    const dlBtn = el("button", {
      style: {
        width: "100%", padding: "5px", borderRadius: "5px",
        border: "1px solid #555", background: "#2a2a2a",
        color: "#ddd", fontSize: "12px", cursor: "pointer", marginBottom: "5px",
      },
      onclick: async () => {
        if (fileBrowser.style.display !== "none") {
          fileBrowser.style.display = "none";
          dlBtn.textContent = "⬇ Download";
          return;
        }
        dlBtn.disabled = true;
        dlBtn.textContent = "Loading files...";
        fileBrowser.innerHTML = `<div style="padding:8px;color:#888;font-size:11px;text-align:center">Fetching file list...</div>`;
        fileBrowser.style.display = "";

        try {
          const token = this.tokenInput ? this.tokenInput.value : "";
          let url = `/hh/repo_files?model_id=${encodeURIComponent(modelId)}`;
          if (token) url += `&token=${encodeURIComponent(token)}`;
          const res  = await fetch(url);
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          this.renderFileBrowser(fileBrowser, data, modelId, folderSelect, fill, statusLabel, dlBtn, progressBar);
        } catch (e) {
          fileBrowser.innerHTML = `<div style="padding:8px;color:#f87171;font-size:11px">Error: ${e.message}</div>`;
        } finally {
          dlBtn.disabled = false;
          dlBtn.textContent = "⬇ Download";
        }
      }
    }, ["⬇ Download"]);

    const tags = (m.tags || []).slice(0, 3).map(t =>
      el("span", {
        style: { fontSize: "10px", padding: "1px 6px", borderRadius: "3px", background: "#333", color: "#aaa", marginRight: "3px" }
      }, [t])
    );

    return el("div", {
      style: { background: "#222", border: "1px solid #333", borderRadius: "8px", padding: "10px", marginBottom: "8px" }
    }, [
      el("div", { style: { fontWeight: "600", fontSize: "12px", marginBottom: "2px", color: "#fff", wordBreak: "break-all" } }, [shortName]),
      el("div", { style: { fontSize: "11px", color: "#888", marginBottom: "5px" } },
         [`${author}  ·  ⬇ ${fmtNum(m.downloads)}  ·  ♥ ${fmtNum(m.likes)}`]),
      el("div", { style: { marginBottom: "7px" } }, tags),
      folderSelect, dlBtn, fileBrowser, progressBar, statusLabel,
      el("a", { href: `https://huggingface.co/${modelId}`, target: "_blank",
                style: { fontSize: "10px", color: "#888", textDecoration: "none" } },
         ["🔗 Open on HuggingFace"]),
    ]);
  }

  renderFileBrowser(container, items, modelId, folderSelect, fill, statusLabel, dlBtn, progressBar) {
    container.innerHTML = "";

    const tree = {};
    items.forEach(item => {
      const parts = item.path.split("/");
      const folder = parts.length === 1 ? "__root__" : parts[0];
      if (!tree[folder]) tree[folder] = [];
      tree[folder].push(item);
    });

    const checkboxes = [];

    const renderSection = (label, files, isRoot) => {
      const section = el("div", { style: { borderBottom: "1px solid #2a2a2a" } });

      if (!isRoot) {
        const folderCb = el("input", { type: "checkbox" });
        folderCb.checked = true;

        const folderLabelEl = el("span", {
          style: { fontSize: "11px", color: "#e07a00", fontWeight: "600", flex: "1" }
        }, ["📂 " + label]);

        const folderHeader = el("div", {
          style: {
            display: "flex", alignItems: "center", gap: "6px",
            padding: "5px 8px", background: "#222", cursor: "pointer", userSelect: "none"
          }
        }, [
          folderCb, folderLabelEl,
          el("span", { style: { fontSize: "10px", color: "#666" } }, [`${files.length} files`]),
        ]);

        const fileList = el("div", { style: { paddingLeft: "8px" } });
        const fileCbs = [];

        files.forEach(item => {
          const cb = el("input", { type: "checkbox" });
          cb.checked = true;
          cb.dataset.path = item.path;
          cb.dataset.size = item.size || 0;
          checkboxes.push(cb);
          fileCbs.push(cb);

          fileList.appendChild(el("div", {
            style: { display: "flex", alignItems: "center", gap: "6px", padding: "3px 8px", borderTop: "1px solid #222" }
          }, [
            cb,
            el("span", { style: { fontSize: "10px", color: "#ccc", flex: "1", wordBreak: "break-all" } }, [item.path.split("/").pop()]),
            el("span", { style: { fontSize: "10px", color: "#666", flexShrink: "0" } }, [fmtSize(item.size)]),
          ]));
        });

        folderCb.addEventListener("change", () => fileCbs.forEach(c => { c.checked = folderCb.checked; }));
        fileCbs.forEach(c => c.addEventListener("change", () => { folderCb.checked = fileCbs.every(x => x.checked); }));

        let expanded = true;
        folderLabelEl.addEventListener("click", () => {
          expanded = !expanded;
          fileList.style.display = expanded ? "" : "none";
        });

        section.appendChild(folderHeader);
        section.appendChild(fileList);
      } else {
        files.forEach(item => {
          const cb = el("input", { type: "checkbox" });
          cb.checked = true;
          cb.dataset.path = item.path;
          cb.dataset.size = item.size || 0;
          checkboxes.push(cb);

          section.appendChild(el("div", {
            style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderTop: "1px solid #222" }
          }, [
            cb,
            el("span", { style: { fontSize: "10px", color: "#ccc", flex: "1", wordBreak: "break-all" } }, [item.path]),
            el("span", { style: { fontSize: "10px", color: "#666", flexShrink: "0" } }, [fmtSize(item.size)]),
          ]));
        });
      }

      container.appendChild(section);
    };

    if (tree["__root__"]) renderSection("Root", tree["__root__"], true);
    Object.entries(tree).forEach(([folder, files]) => {
      if (folder !== "__root__") renderSection(folder, files, false);
    });

    const actions = el("div", { style: { display: "flex", gap: "6px", padding: "8px", background: "#1e1e1e" } }, [
      el("button", {
        style: {
          flex: "1", padding: "5px", borderRadius: "5px",
          border: "1px solid #e07a00", background: "#e07a00",
          color: "#fff", fontSize: "12px", cursor: "pointer", fontWeight: "600"
        },
        onclick: async () => {
          const selected = checkboxes.filter(c => c.checked).map(c => c.dataset.path);
          if (!selected.length) { statusLabel.textContent = "No files selected!"; return; }

          const totalSize = checkboxes
            .filter(c => c.checked)
            .reduce((sum, c) => sum + (parseInt(c.dataset.size) || 0), 0);

          container.style.display = "none";
          progressBar.style.display = "";
          statusLabel.textContent = `Starting... (${fmtSize(totalSize)} total)`;

          try {
            const token = this.tokenInput ? this.tokenInput.value : null;
            const res = await fetch("/hh/download", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model_id: modelId,
                folder: folderSelect.value,
                token: token || null,
                allow_patterns: selected.join(","),
                total_size: totalSize,
              }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            this.pollJob(data.job_id, fill, statusLabel, dlBtn, progressBar);
          } catch (e) {
            statusLabel.textContent = "Error: " + e.message;
            progressBar.style.display = "none";
          }
        }
      }, ["Download Selected"]),
      el("button", {
        style: {
          padding: "5px 12px", borderRadius: "5px",
          border: "1px solid #555", background: "#2a2a2a",
          color: "#aaa", fontSize: "12px", cursor: "pointer"
        },
        onclick: () => { container.style.display = "none"; dlBtn.textContent = "⬇ Download"; }
      }, ["Cancel"]),
    ]);

    container.appendChild(actions);
  }

  async pollJob(jobId, fill, label, btn, bar) {
    const poll = async () => {
      try {
        const res  = await fetch(`/hh/status/${jobId}`);
        const data = await res.json();

        const pct      = data.progress || 0;
        const dlBytes  = data.downloaded || 0;
        const totBytes = data.total || 0;

        fill.style.width = pct + "%";
        label.textContent = `${pct}%  —  ${fmtSize(dlBytes)} / ${totBytes > 0 ? fmtSize(totBytes) : "?"}`;

        if (data.status === "done") {
          fill.style.background = "#22c55e";
          label.textContent = `✅ Done! ${fmtSize(dlBytes)} downloaded — Click ⬇ Download again for more files`;
          btn.textContent = "⬇ Download";
          btn.disabled = false;
          this.loadInstalled();
          this.refreshDisk();
          return;
        }
        if (data.status === "error") {
          fill.style.background = "#f87171";
          label.textContent = "❌ " + (data.log?.[data.log.length - 1] || "Error");
          btn.disabled = false;
          btn.textContent = "⬇ Download";
          return;
        }
        setTimeout(poll, 1000);
      } catch { setTimeout(poll, 2000); }
    };
    poll();
  }

  async loadInstalled() {
    this.installedArea.innerHTML = `<div style="text-align:center;padding:1rem;color:#888">Loading...</div>`;
    try {
      const res  = await fetch("/hh/installed");
      const data = await res.json();
      this.installedArea.innerHTML = "";
      let total = 0;

      for (const [folder, files] of Object.entries(data)) {
        if (!files.length) continue;
        total += files.length;

        const section = el("div", { style: { marginBottom: "14px" } }, [
          el("div", {
            style: {
              fontSize: "11px", fontWeight: "600", color: "#e07a00",
              marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px"
            }
          }, [`${folder} (${files.length})`]),
          ...files.map(f => {
            const row = el("div", {
              style: {
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "4px 0", borderBottom: "1px solid #2a2a2a", gap: "6px"
              }
            });

            const nameCol = el("div", { style: { flex: "1", minWidth: "0" } }, [
              el("div", { style: { fontSize: "11px", color: "#ccc", wordBreak: "break-all" } }, [f.name]),
              el("div", { style: { fontSize: "10px", color: "#666", marginTop: "1px" } }, [fmtSize(f.size)]),
            ]);

            const delBtn = el("button", {
              style: {
                fontSize: "11px", padding: "2px 7px", borderRadius: "4px",
                border: "1px solid #f87171", background: "transparent",
                color: "#f87171", cursor: "pointer", flexShrink: "0"
              },
              onclick: async () => {
                if (!confirm(`Delete ${f.name}?\n(Permanent — no trash)`)) return;
                try {
                  const r = await fetch("/hh/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ full_path: f.full_path }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    row.remove();
                    this.refreshDisk();
                  } else alert("Error: " + d.error);
                } catch (e) { alert("Error: " + e.message); }
              }
            }, ["🗑"]);

            row.appendChild(nameCol);
            row.appendChild(delBtn);
            return row;
          })
        ]);
        this.installedArea.appendChild(section);
      }

      if (total === 0) {
        this.installedArea.innerHTML = `<div style="text-align:center;padding:2rem;color:#888">No models installed yet</div>`;
      }

      this.refreshDisk();
    } catch {
      this.installedArea.innerHTML = `<div style="color:#f87171">Error loading installed models</div>`;
    }
  }
}

app.registerExtension({
  name: "HuggingHIT",
  async setup() {
    const panelInstance = new HuggingHITPanel();
    const panelEl = panelInstance.buildPanel();

    if (app.extensionManager?.registerSidebarTab) {
      app.extensionManager.registerSidebarTab({
        id: "hh.search",
        icon: "pi pi-cloud-download",
        title: "HuggingHIT",
        tooltip: "HuggingHIT - Search & download models",
        type: "custom",
        render(el) {
          el.style.height = "100%";
          el.appendChild(panelEl);
        },
      });
    } else {
      const drawer = Object.assign(document.createElement("div"), {
        style: `position:fixed;right:0;top:0;bottom:0;width:320px;z-index:9998;
                transform:translateX(100%);transition:transform 0.25s ease;
                box-shadow:-4px 0 16px rgba(0,0,0,0.4);`,
      });
      drawer.appendChild(panelEl);

      let open = false;
      const btn = Object.assign(document.createElement("button"), {
        textContent: "🤗",
        title: "HuggingHIT",
        style: `position:fixed;bottom:80px;right:16px;z-index:9999;
                width:44px;height:44px;border-radius:50%;
                background:#e07a00;color:#fff;font-size:20px;
                border:none;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);`,
      });
      btn.onclick = () => {
        open = !open;
        drawer.style.transform = open ? "translateX(0)" : "translateX(100%)";
      };
      document.body.appendChild(drawer);
      document.body.appendChild(btn);
    }
  },
});
