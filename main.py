import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from server.database import init_db, is_remote_database_configured
from server.seeder import seed_database
from server.routes_auth import router as auth_router
from server.routes_eval import router as eval_router
from server.routes_recap import router as recap_router
from server.routes_admin import router as admin_router

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing KI23 Evaluation System database...")
    init_db()
    if not is_remote_database_configured() and not os.environ.get("VERCEL"):
        seed_database(seed_sample_scores=True)
    yield
    print("Shutting down KI23 Evaluation System...")

app = FastAPI(
    title="Sistem Penilaian Acara KI23",
    description="Sistem Penilaian Acara KI23 dengan Role-Based Access Control (RBAC), Rekapitulasi Nilai & Export Excel",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(eval_router)
app.include_router(recap_router)
app.include_router(admin_router)

# Mount static directory jika folder tersedia
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Sistem Penilaian Acara KI23 Backend API Running", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)