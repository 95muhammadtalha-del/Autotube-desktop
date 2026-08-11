import sys
from pathlib import Path

# Add the project root to sys.path so we can import the app modules
sys.path.insert(0, r"e:\Try\python_clipper")

from app.clipper import ClipOptions, _build_crop_filter_complex, _music_audio_graph, AspectRatio, FitMode

opts = ClipOptions(
    aspect_ratio=AspectRatio.NINE_16,
    fit_mode=FitMode.CROP,
    ass_path=Path("dummy.ass"),
    clip_id="123",
    index=0,
    flip_horizontal=True,
    video_volume=150.0,
    music_path=Path("dummy.mp3"),
    music_volume=50.0
)

print("--- CROP MODE GRAPH ---")
fc = _build_crop_filter_complex(1080, 1920, opts, Path("."))
fc += ";" + _music_audio_graph(1, opts.video_volume, opts.music_volume, opts.music_duck)
print(fc)

print("\n--- DONE ---")
