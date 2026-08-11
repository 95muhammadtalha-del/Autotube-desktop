$ErrorActionPreference = "Stop"

Write-Host "Building Python Backend..."

cd python_clipper
if (-not (Test-Path ".venv/Scripts/Activate.ps1")) {
    Write-Host "Virtual environment not found! Run setup script first."
    exit 1
}

& .venv\Scripts\python.exe -m pip install pyinstaller

Write-Host "Running PyInstaller..."
& .venv\Scripts\pyinstaller.exe --name "python_clipper" --noconfirm --onedir `
    --add-data "assets;assets" `
    --hidden-import "uvicorn" `
    --hidden-import "fastapi" `
    --hidden-import "pydantic" `
    --hidden-import "faster_whisper" `
    --hidden-import "av" `
    --hidden-import "cv2" `
    --hidden-import "PIL" `
    app/main.py

Write-Host "Build complete! Output is in python_clipper/dist/python_clipper"
cd ..
