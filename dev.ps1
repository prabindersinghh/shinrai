# Starts the backend (port 8000) and the frontend (port 5173). Usage: ./dev.ps1   or   ./dev.ps1 seed
param([string]$task = "dev")
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($task -eq "seed") {
  Push-Location "$root/backend"; python -m scripts.make_seed; python -m scripts.make_ground_seed; Pop-Location
  exit
}
if ($task -eq "validate") { Push-Location "$root/backend"; python -m scripts.validate; Pop-Location; exit }
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root/backend'; python -m uvicorn app.main:app --port 8000 --reload"
Push-Location "$root/frontend"; npm run dev; Pop-Location
