<div align="center">

# 🤗 ComfyUI-HuggingHIT

**Download Hugging Face models directly from your ComfyUI sidebar — no terminal needed.**

<img width="429" height="959" alt="image" src="https://github.com/user-attachments/assets/24d1c1a6-c794-4063-ac5b-a72eb36127af" />


</div>

***

## ✨ What is ComfyUI-HuggingHIT?

**ComfyUI-HuggingHIT** is a custom node that embeds a full Hugging Face model manager directly into the ComfyUI sidebar. Search, browse, download, and delete models — all without leaving ComfyUI or touching the terminal.

> 💡 Perfect for cloud GPU setups (RunPod, Vast.ai, Google Colab) where you need a fast, visual way to manage your models.

***

## 🖼️ Screenshots

<!-- Add your screenshots below -->
<!--  -->
<!--  -->
<!--  -->

*Screenshots coming soon — feel free to contribute!*

***

## 🚀 Features

- **🔍 Search Hugging Face** — Search by name or filter by pipeline type (text-to-image, LoRA, ControlNet, etc.)
- **📁 Browse Repo Files** — See every file in a repo with sizes before downloading
- **⬇️ Smart Downloads** — Download full repos or cherry-pick specific files with allow-patterns
- **📊 Real-time Progress** — Live progress bar with downloaded/total size tracking
- **🗂️ Folder Routing** — Automatically places models in the correct ComfyUI folder (checkpoints, loras, vae, etc.)
- **🗑️ Delete Models** — Remove installed models directly from the UI
- **💾 Disk Space Monitor** — Live disk usage display (GiB, matches `df -h` output exactly)
- **🔐 Private Models** — Support for Hugging Face tokens to access gated/private repos
- **☁️ Cloud-Friendly** — Designed for remote GPU instances where terminal access is inconvenient

***

## 📦 Installation

### Option 1: Clone directly into ComfyUI custom nodes

```bash
cd ~/ComfyUI/custom_nodes
git clone https://github.com/Diskfo/ComfyUI-HuggingHIT.git
```

### Option 2: ComfyUI Manager

Search for **ComfyUI-HuggingHIT** in [ComfyUI Manager](https://github.com/ltdrdata/ComfyUI-Manager) and click Install.

### Requirements

```bash
pip install huggingface_hub
```

That's it — no other dependencies beyond what ComfyUI already ships with.

***

## 🗂️ Supported Model Folders

| Folder Key | ComfyUI Path | Typical Use |
|---|---|---|
| `checkpoints` | `models/checkpoints` | Stable Diffusion, FLUX checkpoints |
| `loras` | `models/loras` | LoRA / LyCORIS adapters |
| `controlnet` | `models/controlnet` | ControlNet models |
| `vae` | `models/vae` | VAE encoders/decoders |
| `upscale_models` | `models/upscale_models` | ESRGAN, Real-ESRGAN upscalers |
| `clip` | `models/clip` | CLIP text encoders |
| `unet` | `models/unet` | UNet-only model files |
| `embeddings` | `models/embeddings` | Textual Inversion embeddings |
| `hypernetworks` | `models/hypernetworks` | Hypernetwork files |
| `diffusion_models` | `models/diffusion_models` | Diffusion model weights |
| `text_encoders` | `models/text_encoders` | T5, CLIP-L, CLIP-G encoders |

***

## 🔌 API Endpoints

The node exposes the following REST API on your ComfyUI server:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/hh/folders` | List all model folder paths |
| `GET` | `/hh/search?q=flux&pipeline=text-to-image` | Search Hugging Face models |
| `GET` | `/hh/repo_files?model_id=black-forest-labs/FLUX.1-dev` | List files in a repo |
| `POST` | `/hh/download` | Start a download job |
| `GET` | `/hh/status/{job_id}` | Poll download progress |
| `GET` | `/hh/installed` | List all installed models |
| `POST` | `/hh/delete` | Delete an installed model |
| `GET` | `/hh/diskspace` | Get disk usage (GiB) |

***

## 💡 Usage

1. **Open the sidebar** in ComfyUI and find the 🤗 HuggingHIT panel
2. **Search** for any model by name or filter by type
3. **Browse files** in the repo and select what you need
4. **Choose the destination folder** from the dropdown
5. **Click Download** — watch the progress bar fill up
6. The model is ready to use in ComfyUI immediately after download

### Using a Hugging Face Token

For gated models (e.g., FLUX.1-dev, Llama), paste your token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) into the token field before downloading.

***

## ⚙️ Requirements

- **OS:** Linux or macOS *(Windows support coming soon)*
- **ComfyUI** installed at `~/ComfyUI`
- **Python 3.8+**
- `huggingface_hub` pip package

> ☁️ Optimized for cloud GPU instances (RunPod, Vast.ai, Lambda Labs, Google Colab)

***

## 🛠️ Technical Notes

- **Disk space** is reported in GiB (same as `df -h`) by reading `/dev/nvme0n1p1` via `df -BG`
- **Downloads** use `huggingface_hub.snapshot_download` with async progress tracking
- **File filtering** uses `allow_patterns` — pass comma-separated globs like `*.safetensors, *.json`
- **Security** — the delete endpoint validates that paths stay within `models/` directory

***

## 🤝 Contributing

Pull requests are welcome! Some ideas for contributions:

- [ ] Multi-file selective download UI
- [ ] Download queue / batch downloads  
- [ ] Model preview cards with example images
- [ ] Import from CivitAI
- [ ] Search filter by file size / format

***

## 📄 License

MIT License — free to use, modify, and distribute.

> Copyright (c) 2026 Diskfo (Diskfo)
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> **The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.**

***

<div align="center">

Made with ❤️ for the ComfyUI community

⭐ **Star this repo if it saved you time!** ⭐

</div>
