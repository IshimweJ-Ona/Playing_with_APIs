import os
from typing import Union, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
from cachetools import TTLCache
from fastapi.middleware.cors import CORSMiddleware

# ------------------------------
# Load environment variables
# ------------------------------
load_dotenv()

TMDB_API_KEY: Optional[str] = os.getenv("TMDB_API_KEY")
if not TMDB_API_KEY:
    raise RuntimeError("TMDB_API_KEY not found in .env file")

TMDB_BASE_URL = "https://api.themoviedb.org/3"
IMG_BASE = "https://image.tmdb.org/t/p/w500"

# ------------------------------
# FastAPI app
# ------------------------------
app = FastAPI(
    title="MovieStream Backend",
    description="Backend API for MovieStream app with caching",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------
# Caches (manual async-compatible)
# ------------------------------
genres_cache = TTLCache(maxsize=1, ttl=600)
movies_cache = TTLCache(maxsize=100, ttl=600)
videos_cache = TTLCache(maxsize=200, ttl=600)

# ------------------------------
# Helper function
# ------------------------------
def build_url(endpoint: str, params: Optional[dict[str, Union[str, int]]] = None) -> tuple[str, dict[str, Union[str, int]]]:
    """Construct TMDB URL with API key"""
    if params is None:
        params = {}
    # TMDB_API_KEY is guaranteed not None (checked above)
    params["api_key"] = TMDB_API_KEY  # type: ignore
    url = f"{TMDB_BASE_URL}/{endpoint}"
    return url, params

# ------------------------------
# Serve frontend
# ------------------------------
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(frontend_path, "index.html"))

# ------------------------------
# API Endpoints
# ------------------------------

@app.get("/api/genres")
async def get_genres():
    """Return list of movie genres with caching"""
    if "genres" in genres_cache:
        return genres_cache["genres"]

    url, params = build_url("genre/movie/list")
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch genres")
        data = resp.json()

    genres_cache["genres"] = data
    return data


@app.get("/api/movies")
async def get_movies(
    q: str = Query("", description="Search query"),
    genre: str = Query("all", description="Filter by genre ID"),
    sort: str = Query("popular", description="Sort by popular/newest/rating"),
    page: int = Query(1, ge=1, description="Page number")
):
    """Fetch movies from TMDB with caching"""

    cache_key = f"{q}|{genre}|{sort}|{page}"
    if cache_key in movies_cache:
        return movies_cache[cache_key]

    # Initialize params with type hint
    params: dict[str, Union[str, int]] = {"page": page}

    if q.strip():
        endpoint = "search/movie"
        params["query"] = q
    else:
        endpoint = "discover/movie"

    if genre != "all":
        params["with_genres"] = genre

    if sort == "newest":
        params["sort_by"] = "release_date.desc"
    elif sort == "rating":
        params["sort_by"] = "vote_average.desc"
    else:
        params["sort_by"] = "popularity.desc"

    url, final_params = build_url(endpoint, params)
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=final_params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch movies")
        data = resp.json()

    movies_cache[cache_key] = data
    return data


@app.get("/api/movies/{movie_id}/videos")
async def get_movie_videos(movie_id: int):
    """Get YouTube videos/trailers for a movie with caching"""
    cache_key = f"videos_{movie_id}"
    if cache_key in videos_cache:
        return videos_cache[cache_key]

    params: dict[str, Union[str, int]] = {}
    url, params = build_url(f"movie/{movie_id}/videos", params)
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch videos")
        data = resp.json()
        youtube_videos = [v for v in data.get("results", []) if v.get("site") == "YouTube"]

    videos_cache[cache_key] = {"results": youtube_videos}
    return {"results": youtube_videos}


# ------------------------------
# Health check
# ------------------------------
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
