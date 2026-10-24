# Unix-style shortcuts. On Windows without make, use ./dev.ps1 (same steps).
.PHONY: dev seed backend frontend validate

dev:
	cd backend && python -m uvicorn app.main:app --port 8000 --reload & \
	cd frontend && npm run dev

backend:
	cd backend && python -m uvicorn app.main:app --port 8000 --reload

frontend:
	cd frontend && npm run dev

seed:
	cd backend && python -m scripts.make_seed && python -m scripts.make_ground_seed

validate:
	cd backend && python -m scripts.validate
