import sys
import subprocess
from pathlib import Path

# Add the project root to sys.path so we can import the app modules
sys.path.insert(0, r"e:\Try\python_clipper")

from app.clipper import ClipOptions, _build_crop_filter_complex, _music_audio_graph, AspectRatio, FitMode

def test_permutation(speed, vol, has_music, flip):
    opts = ClipOptions(
        aspect_ratio=AspectRatio.NINE_16,
        fit_mode=FitMode.CROP,
        ass_path=Path("dummy.ass"),
        clip_id="123",
        index=0,
        flip_horizontal=flip,
        video_speed=speed,
        video_volume=vol,
        music_path=Path("dummy.mp3") if has_music else None,
        music_volume=50.0 if has_music else None
    )

    # Re-implement generate_clip's audio logic here to perfectly mirror it:
    fc = _build_crop_filter_complex(1080, 1920, opts, Path("."))
    
    music_idx = 1
    if has_music:
        fc = fc + ";" + _music_audio_graph(music_idx, opts.video_volume, opts.music_volume, opts.music_duck)
        audio_out_label = "[aout]"
    else:
        if opts.video_volume != 100.0:
            v_base = opts.video_volume / 100.0
            fc = fc + f";[0:a]volume={v_base:.3f}[aout]"
            audio_out_label = "[aout]"
        else:
            audio_out_label = "0:a"

    if opts.video_speed != 1.0:
        fc = fc + f";[outv]setpts=PTS/{opts.video_speed}[outv_f]"
        
        # Override the audio map if speed is changed
        filter_in = "[0:a]" if audio_out_label == "0:a" else audio_out_label
        fc = fc + f";{filter_in}atempo={opts.video_speed}[aout_f]"
        audio_map = ["-map", "[aout_f]"]
            
        fc_out_v = "[outv_f]"
    else:
        fc_out_v = "[outv]"
        audio_map = ["-map", audio_out_label]
        if audio_out_label == "0:a":
            audio_map = ["-map", "0:a?"]

    cmd = [
        "ffmpeg", "-y",
        "-i", "dummy.mp4"
    ]
    if has_music:
        cmd += ["-i", "dummy.mp4"]
        
    cmd += [
        "-filter_complex", fc,
        "-map", fc_out_v, *audio_map,
        "-t", "1",
        "out_test.mp4"
    ]

    print(f"\nTesting: Speed={speed} Vol={vol} Music={has_music} Flip={flip}")
    print("Graph:", fc)
    print("Map:", fc_out_v, audio_map)
    
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("FAILED! Exit code:", proc.returncode)
        print(proc.stderr[-500:])
    else:
        print("SUCCESS")

test_permutation(1.0, 100.0, False, False)
test_permutation(1.2, 100.0, False, False)
test_permutation(1.0, 150.0, False, False)
test_permutation(1.2, 150.0, False, False)
test_permutation(1.0, 100.0, True, False)
test_permutation(1.2, 100.0, True, False)
test_permutation(1.2, 150.0, True, False)

test_permutation(1.2, 100.0, False, True)

