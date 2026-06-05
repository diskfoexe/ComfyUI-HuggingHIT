import server
from aiohttp import web
import os
import json
import asyncio
import sys
import time

WEB_DIRECTORY = "."
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

COMFY_BASE = os.path.expanduser("~/ComfyUI")
MODELS_BASE = os.path.join(COMFY_BASE, "models")

FOLDER_MAP = {
    "checkpoints":      "checkpoints",
    "loras":            "loras",
    "controlnet":       "controlnet",
    "vae":              "vae",
    "upscale_models":   "upscale_models",
    "clip":             "clip",
    "unet":             "unet",
    "embeddings":       "embeddings",
    "hypernetworks":    "hypernetworks",
    "diffusion_models": "diffusion_models",
    "text_encoders":    "text_encoders",
}

download_jobs = {}

@server.PromptServer.instance.routes.get("/hh/folders")
async def get_folders(request):
    folders = {}
    for key, rel in FOLDER_MAP.items():
        path = os.path.join(MODELS_BASE, rel)
        os.makedirs(path, exist_ok=True)
        folders[key] = path
    return web.json_response(folders)

@server.PromptServer.instance.routes.get("/hh/search")
async def search_models(request):
    query = request.rel_url.query.get("q", "")
    pipeline = request.rel_url.query.get("pipeline", "")
    limit = request.rel_url.query.get("limit", "12")

    import urllib.request
    import urllib.parse

    url = f"https://huggingface.co/api/models?limit={limit}&sort=downloads&direction=-1&full=false"
    if query:
        url += f"&search={urllib.parse.quote(query)}"
    if pipeline:
        url += f"&pipeline_tag={urllib.parse.quote(pipeline)}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ComfyUI-HuggingHIT/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        return web.json_response(data)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/hh/repo_files")
async def get_repo_files(request):
    model_id = request.rel_url.query.get("model_id", "")
    token = request.rel_url.query.get("token", None) or None

    if not model_id:
        return web.json_response({"error": "missing model_id"}, status=400)

    try:
        from huggingface_hub import list_repo_tree
        from huggingface_hub.hf_api import RepoFile, RepoFolder

        files = []
        for item in list_repo_tree(model_id, token=token, recursive=True):
            if isinstance(item, RepoFolder):
                continue
            files.append({
                "path": item.path,
                "type": "file",
                "size": getattr(item, "size", 0),
            })
        return web.json_response(files)
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.post("/hh/download")
async def start_download(request):
    body = await request.json()
    model_id = body.get("model_id", "")
    folder_key = body.get("folder", "checkpoints")
    token = body.get("token", None) or None
    patterns_raw = body.get("allow_patterns", "") or ""
    allow_patterns = [p.strip() for p in patterns_raw.split(",")] if patterns_raw.strip() else None
    total_size = body.get("total_size", 0)

    if not model_id:
        return web.json_response({"error": "missing model_id"}, status=400)

    target_dir = os.path.join(MODELS_BASE, FOLDER_MAP.get(folder_key, "checkpoints"))
    os.makedirs(target_dir, exist_ok=True)

    import hashlib
    job_id = hashlib.md5((model_id + patterns_raw).encode()).hexdigest()[:12]

    download_jobs[job_id] = {
        "status": "starting",
        "progress": 0,
        "downloaded": 0,
        "total": total_size,
        "log": [],
    }

    asyncio.create_task(_run_download(job_id, model_id, target_dir, token, allow_patterns))
    return web.json_response({"job_id": job_id, "target_dir": target_dir})

async def _run_download(job_id, model_id, target_dir, token=None, allow_patterns=None):
    download_jobs[job_id]["status"] = "downloading"
    download_jobs[job_id]["log"].append(f"Starting download of {model_id}...")

    start_time = time.time()

    def do_download():
        from huggingface_hub import snapshot_download
        snapshot_download(
            repo_id=model_id,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            token=token,
            allow_patterns=allow_patterns,
            ignore_patterns=["*.msgpack", "*.h5", "flax_model*", "tf_model*"] if not allow_patterns else [],
        )

    async def track_progress():
        while download_jobs[job_id]["status"] == "downloading":
            try:
                total_downloaded = 0
                for root, dirs, files in os.walk(target_dir):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            if os.path.getmtime(fp) >= start_time:
                                total_downloaded += os.path.getsize(fp)
                        except:
                            pass
                download_jobs[job_id]["downloaded"] = total_downloaded
                total = download_jobs[job_id]["total"]
                if total > 0:
                    download_jobs[job_id]["progress"] = min(99, int(total_downloaded / total * 100))
            except:
                pass
            await asyncio.sleep(1)

    tracker = asyncio.create_task(track_progress())

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, do_download)

        total_downloaded = 0
        for root, dirs, files in os.walk(target_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    if os.path.getmtime(fp) >= start_time:
                        total_downloaded += os.path.getsize(fp)
                except:
                    pass

        download_jobs[job_id]["status"] = "done"
        download_jobs[job_id]["progress"] = 100
        download_jobs[job_id]["downloaded"] = total_downloaded
        download_jobs[job_id]["log"].append("Download completed successfully")
    except Exception as e:
        download_jobs[job_id]["status"] = "error"
        download_jobs[job_id]["log"].append(str(e))
    finally:
        tracker.cancel()

@server.PromptServer.instance.routes.get("/hh/status/{job_id}")
async def get_status(request):
    job_id = request.match_info["job_id"]
    job = download_jobs.get(job_id)
    if not job:
        return web.json_response({"error": "not found"}, status=404)
    return web.json_response(job)

@server.PromptServer.instance.routes.get("/hh/installed")
async def get_installed(request):
    result = {}
    EXTENSIONS = (".safetensors", ".ckpt", ".pt", ".bin", ".pth", ".gguf")

    for key, rel in FOLDER_MAP.items():
        path = os.path.join(MODELS_BASE, rel)
        if not os.path.isdir(path):
            result[key] = []
            continue

        files = []
        for root, dirs, filenames in os.walk(path):
            for f in filenames:
                if f.endswith(EXTENSIONS):
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, path)
                    size = os.path.getsize(full_path)
                    files.append({
                        "name": rel_path,
                        "size": size,
                        "full_path": full_path,
                    })
        result[key] = files

    return web.json_response(result)

@server.PromptServer.instance.routes.post("/hh/delete")
async def delete_model(request):
    body = await request.json()
    full_path = body.get("full_path", "")

    if not full_path:
        return web.json_response({"error": "missing full_path"}, status=400)

    if not os.path.abspath(full_path).startswith(os.path.abspath(MODELS_BASE)):
        return web.json_response({"error": "invalid path"}, status=403)

    if not os.path.exists(full_path):
        return web.json_response({"error": "file not found"}, status=404)

    try:
        os.remove(full_path)
        return web.json_response({"ok": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@server.PromptServer.instance.routes.get("/hh/diskspace")
async def get_disk_space(request):
    import subprocess
    try:
        result = subprocess.run(
            ["df", "-BG", "/"],
            capture_output=True, text=True
        )
        lines = result.stdout.strip().splitlines()
        parts = lines[1].split()
        total = int(parts[1].replace("G", "")) * 1000000000
        used  = int(parts[2].replace("G", "")) * 1000000000
        free  = int(parts[3].replace("G", "")) * 1000000000
        return web.json_response({"total": total, "used": used, "free": free})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

print("[HuggingHIT] Loaded — sidebar panel available")
