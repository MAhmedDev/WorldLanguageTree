"""
pnpm narrate  (runs: uv run --python 3.12 --with kokoro-onnx --with soundfile python scripts/narrate.py)

Renders the Story of Language narration to audio with a local neural voice
(Kokoro-82M via kokoro-onnx, Apache-2.0). No text leaves the machine.

- Model files are downloaded once into .cache/kokoro/ (git-ignored).
- Clips go to public/audio/narration/<clip>.mp3 with manifest.json mapping
  clip id -> { file, hash }. The hash covers the exact spoken text, so the app
  only plays a clip that matches the current (verified) narration, and
  re-running regenerates only clips whose text changed.
"""
import hashlib, json, os, re, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "kokoro")
OUT = os.path.join(ROOT, "public", "audio", "narration")
STORY = os.path.join(ROOT, "data", "story", "story-of-language.json")
VOICE, LANG, SPEED = "bm_george", "en-gb", 0.92
MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"


def ensure_model():
    os.makedirs(CACHE, exist_ok=True)
    for f in ("kokoro-v1.0.onnx", "voices-v1.0.bin"):
        p = os.path.join(CACHE, f)
        if not os.path.exists(p):
            print("downloading", f)
            urllib.request.urlretrieve(MODEL_URL + f, p)
    return os.path.join(CACHE, "kokoro-v1.0.onnx"), os.path.join(CACHE, "voices-v1.0.bin")


def speakable(text: str) -> str:
    """Spoken form only: the displayed, verified text is never changed."""
    t = text
    t = re.sub(r"\bc\.\s*(?=\d)", "circa ", t)
    t = re.sub(r"\bBCE\b", "B.C.E.", t)
    t = re.sub(r"\bCE\b", "C.E.", t)
    t = re.sub(r"(\d)\s*[–-]\s*(\d)", r"\1 to \2", t)
    t = t.replace("–", ", ").replace("—", ", ")
    return t


def clips(story):
    """Must match clip ids used by src/story/StoryMode.tsx (narrationClip)."""
    for ch in story["chapters"]:
        for i, p in enumerate(ch["intro"]):
            text = (f'{ch["title"]}. ' if i == 0 else "") + p["text"]
            yield f'{ch["id"]}-intro-{i}', text
        for b in ch["beats"]:
            yield f'{ch["id"]}-beat-{b["id"]}', f'{b["title"]}. {b["text"]}'


def main():
    import soundfile as sf
    from kokoro_onnx import Kokoro

    model, voices = ensure_model()
    k = Kokoro(model, voices)
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    story = json.load(open(STORY))
    wanted = {}
    made = 0
    for cid, text in clips(story):
        h = hashlib.sha256(f"{VOICE}|{SPEED}|{text}".encode()).hexdigest()[:16]
        # `text` lets the app play a clip only when it matches the current verified narration
        wanted[cid] = {"file": f"{cid}.mp3", "hash": h, "text": text}
        if manifest.get(cid, {}).get("hash") == h and os.path.exists(os.path.join(OUT, f"{cid}.mp3")):
            continue
        samples, sr = k.create(speakable(text), voice=VOICE, speed=SPEED, lang=LANG)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            sf.write(tmp.name, samples, sr)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", os.path.join(OUT, f"{cid}.mp3")], check=True)
        os.unlink(tmp.name)
        made += 1
        print(f"  {cid}  {len(samples)/sr:.1f}s")
    for cid in set(manifest) - set(wanted):
        try:
            os.unlink(os.path.join(OUT, manifest[cid]["file"]))
        except FileNotFoundError:
            pass
    json.dump(wanted, open(manifest_path, "w"), indent=1, sort_keys=True, ensure_ascii=False)
    print(f"{made} clips rendered, {len(wanted)} total -> public/audio/narration/")


if __name__ == "__main__":
    sys.exit(main())
