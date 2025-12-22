from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, diagnostics, types, cleaning, outliers, transforms, split, export

app = FastAPI(
    title="ML Preprocessing Tool API",
    description="Backend API for the Modular ML Preprocessing Tool",
    version="1.0.0"
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router)
app.include_router(diagnostics.router)
app.include_router(types.router)
app.include_router(cleaning.router)
app.include_router(outliers.router)
app.include_router(transforms.router)
app.include_router(split.router)
app.include_router(export.router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ml-preprocessing-api"}
