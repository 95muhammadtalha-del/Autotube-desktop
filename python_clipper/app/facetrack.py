import cv2
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Load the Haar Cascade (fast, CPU-friendly)
face_cascade = None

def init_cascade():
    global face_cascade
    if face_cascade is None:
        cascade_path = Path(cv2.__file__).parent / "data" / "haarcascade_frontalface_default.xml"
        if cascade_path.exists():
            face_cascade = cv2.CascadeClassifier(str(cascade_path))
        else:
            logger.warning("Haar cascade not found at %s", cascade_path)

def generate_keyframes(video_path: str, start: float, end: float) -> list[dict]:
    """Scans the video segment and returns a list of ReframeKeyframe dicts to follow the face."""
    init_cascade()
    if face_cascade is None:
        return []

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Could not open video for face tracking: %s", video_path)
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    
    if width <= 0:
        cap.release()
        return []

    # Jump to start time
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)

    # We want to sample at ~4 fps for speed
    frame_step = max(1, int(fps / 4))
    
    current_frame = int(start * fps)
    end_frame = int(end * fps)

    raw_points = []
    
    while current_frame <= end_frame:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Only process every Nth frame
        if (current_frame % frame_step) == 0:
            # Resize for speed (width=640)
            small = cv2.resize(frame, (640, int(640 * frame.shape[0] / frame.shape[1])))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5, minSize=(30, 30))
            if len(faces) > 0:
                # Pick the largest face (w * h)
                faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
                x, y, w, h = faces[0]
                center_x = x + w / 2.0
                
                # Convert back to original scale percentage (0-100)
                pct_x = (center_x / 640.0) * 100.0
                time_offset = (current_frame / fps) - start
                
                raw_points.append({"time": round(time_offset, 3), "pos_x": pct_x})
                
        current_frame += 1

    cap.release()

    if not raw_points:
        return []

    # Smooth the points (moving average) to avoid jitter
    smoothed = []
    window = 2  # smooth over +/- 2 points
    for i in range(len(raw_points)):
        start_idx = max(0, i - window)
        end_idx = min(len(raw_points), i + window + 1)
        avg_x = sum(p["pos_x"] for p in raw_points[start_idx:end_idx]) / (end_idx - start_idx)
        
        smoothed.append({
            "time": raw_points[i]["time"],
            "pos_x": round(avg_x, 2),
            "pos_y": 50,
            "zoom": 100
        })

    # Ensure we have a start and end keyframe for ffmpeg interpolation
    if smoothed:
        if smoothed[0]["time"] > 0.1:
            smoothed.insert(0, {"time": 0.0, "pos_x": smoothed[0]["pos_x"], "pos_y": 50, "zoom": 100})
        
        duration = end - start
        if smoothed[-1]["time"] < duration - 0.1:
            smoothed.append({"time": round(duration, 3), "pos_x": smoothed[-1]["pos_x"], "pos_y": 50, "zoom": 100})

    return smoothed
