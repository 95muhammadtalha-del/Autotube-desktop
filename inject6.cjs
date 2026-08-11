const fs = require('fs');
const path = 'python_clipper/app/jobs.py';
let code = fs.readFileSync(path, 'utf8');

const targetStr = "windows = selector.select_clips(transcript, req.num_clips, req.clip_length)";
const bypassStr = `        if getattr(req, "clip_start", None) is not None:
            c_start = req.clip_start
            c_len = req.clip_length if getattr(req, "clip_length", None) else 30.0
            windows = [{"start": c_start, "end": c_start + c_len, "title": "Viral Highlight"}]
        else:
            windows = selector.select_clips(transcript, req.num_clips, getattr(req, "clip_length", None))`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, bypassStr);
    fs.writeFileSync(path, code);
    console.log('Modified jobs.py');
} else {
    console.log('Could not find target string in jobs.py');
}
