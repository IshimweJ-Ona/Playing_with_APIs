## MovieStream — Movie Ratings + Trailers Web App

A web application using FastAPI & HTML, CSS, JS that allows users to browse movies, filter by genre, search, sort and watch official YouTube trailers. The web app uses `The Movie Database (TMDB) API`.

This project includes Docker deployment, Nginx reverse proxy, and is ready for deployment on school-provided servers with load balancer support.

## Live Deployment
- **Site**: `www.jonaintra.tech/movies/`
- **YouTube Demo**: `https://youtu.be/v8okXb8T-pg`

## Features

### Movie Features
- Search movies by title
- Filter by genre
- Sort by:
  - Popularity
  - Latest releases
  - Highest rated
- View official YouTube trailers
- View movie posters and summaries
- Pagination support

### Technical Features
- FastAPI backend with async HTTP requests
- **Retry logic** with exponential backoff (tenacity)
- **Caching** using TTLCache (600 seconds TTL)
- **Request timeouts** (10s default, 5s connect)
- Secure `.env` for API key management
- Full Docker containerization with Uvicorn
- Nginx reverse proxy & load balancing support
- CORS middleware for cross-origin requests
- Debounced frontend search (350ms)
- Modal focus trap & keyboard support (Escape to close)
- Responsive, accessible frontend UI
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Gzip compression in Nginx

## Project Structure

```
movie_web/
│── backend/
│     ├── main.py                  (FastAPI app, endpoints, retries)
│     ├── requirements.txt         (Python dependencies)
│     └── .env                     (ignored in git)
│
│── frontend/
│     ├── index.html               (HTML template)
│     ├── styles.css               (Responsive styling)
│     └── scripts.js               (Debounced search, modal, API calls)
│
│── nginx/
│     └── default.conf             (Reverse proxy, caching, compression)
│
│── venv/                          (ignored)
│── docker-compose.yml
│── Dockerfile                     (Multi-stage, non-root user)
│── .dockerignore
│── .gitignore
│── README.md
```

## Backend

### 1. TMDB API Integration
The backend loads your API key from `.env`:
```
TMDB_API_KEY=your_key_here
```

Endpoints used:
- `GET /genre/movie/list` → Fetch all genres
- `GET /search/movie` → Search by query
- `GET /discover/movie` → Discover with filters & sorting
- `GET /movie/{id}/videos` → Fetch YouTube trailers

### 2. Caching with TTLCache
Reduces API calls and improves response times:

```python
genres_cache   → Movie genre list (600s TTL)
movies_cache   → Search/discovery results (600s TTL, max 100 entries)
videos_cache   → Trailers per movie (600s TTL, max 200 entries)
```

### 3. Retry Logic
Uses **tenacity** library with exponential backoff:
- Max 3 retry attempts
- 1-10s exponential backoff
- Catches `RequestError` exceptions
- Automatic timeout handling (10s default)

### 4. API Endpoints

| Endpoint | Method | Query Params | Description |
|----------|--------|--------------|-------------|
| `/api/health` | GET | — | Health check |
| `/api/genres` | GET | — | All movie genres |
| `/api/movies` | GET | `q`, `genre`, `sort`, `page` | Search/discover movies |
| `/api/movies/{id}/videos` | GET | — | YouTube trailers for movie |

**Example requests:**
```
GET /api/genres
GET /api/movies?q=inception&page=1
GET /api/movies?genre=28&sort=newest&page=1
GET /api/movies/550/videos
```

## Frontend Improvements

### Debounced Search
Input waits 350ms after user stops typing before API call:
```javascript
qInput.addEventListener('input', debounce(e => { ... }, 350));
```

### Modal Accessibility
- Focus trap (Tab cycles within modal)
- Close on `Escape` key
- Click backdrop to close
- Keyboard navigation support

### Error Handling
- Loading state shows placeholder
- Network errors displayed to user
- Empty state for no results

## Docker Deployment

### Build & Run Locally
```bash
docker-compose up -d --build
```

- **Backend**: http://localhost:8000 (FastAPI)
- **Frontend**: http://localhost (Nginx)
- **API**: http://localhost/api

### Stop Containers
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f web
docker-compose logs -f nginx
```

### Docker Improvements
- Non-root user (`appuser`) for security
- Uvicorn with 2 workers
- Health checks with 30s interval
- Depends-on for service ordering
- .dockerignore for clean builds

## School Server Deployment (web-01, web-02, lb-01)

### On web-01 & web-02

1. **Copy project files** (no venv):
```bash
scp -i ~/.ssh/<private_key> -r backend frontend ubuntu@<IP>:~/movie_web/
```

2. **Install dependencies**:
```bash
cd ~/movie_web
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

3. **Create systemd service** at `/etc/systemd/system/moviestream.service`:
```ini
[Unit]
Description=MovieStream FastAPI backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/movie_web
Environment="PATH=/home/ubuntu/movie_web/venv/bin"
ExecStart=/home/ubuntu/movie_web/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

4. **Enable & start service**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable moviestream.service
sudo systemctl start moviestream.service
sudo systemctl status moviestream.service
```

5. **View logs in real-time**:
```bash
sudo journalctl -u moviestream.service -f
```

6. **Create Nginx config** at `/etc/nginx/sites-available/moviestream`:
```nginx
server {
    listen 80;
    server_name web-01 web-02 jonaintra.tech www.jonaintra.tech;

    root /home/ubuntu/movie_web/frontend;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json text/css application/javascript;

    location /movies/ {
        alias /home/ubuntu/movie_web/frontend/;
        index index.html;
        try_files $uri $uri/ /index.html;
        expires 1d;
    }

    location = /movies/ {
        return 302 /movies/index.html;
    }

    # Proxy API requests to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header Referrer-Policy "no-referrer-when-downgrade";
}
```

7. **Enable Nginx site**:
```bash
sudo ln -s /etc/nginx/sites-available/moviestream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### On lb-01 (HAProxy)

Update `/etc/haproxy/haproxy.cfg`:
```haproxy
# HTTP to HTTPS redirect
frontend http_front
    bind *:80
    mode http
    redirect scheme https code 301 if !{ ssl_fc }

# HTTPS frontend
frontend https_front
    bind *:443 ssl crt /etc/ssl/private/jonaintra.tech.pem
    mode http

    # Movie app routing
    acl is_movie_app path_beg /movies
    acl host_domain hdr(host) -i jonaintra.tech www.jonaintra.tech
    use_backend movies_backend if host_domain is_movie_app

    default_backend web_servers

# Default backend (other apps)
backend web_servers
    balance roundrobin
    server web-01 <IP_WEB01>:80 check
    server web-02 <IP_WEB02>:80 check
    http-response set-header X-Served-By %[srv_name]

# Movie backend
backend movies_backend
    balance roundrobin
    server web-01 <IP_WEB01>:80 check
    server web-02 <IP_WEB02>:80 check
    http-response set-header X-Served-By %[srv_name]
```

Reload HAProxy:
```bash
sudo systemctl reload haproxy
```

### Debugging on Servers

**Check service status:**
```bash
sudo systemctl status moviestream.service
```

**Watch logs live:**
```bash
sudo journalctl -u moviestream.service -f
```

**Restart after code changes:**
```bash
sudo systemctl daemon-reload
sudo systemctl restart moviestream.service
```

**Check Nginx:**
```bash
sudo nginx -t
sudo service nginx restart
```
## Performance Optimizations

- **Caching**: 600s TTL on genres, movies, trailers
- **Retries**: Exponential backoff for network resilience
- **Timeouts**: 10s request timeout, 5s connect timeout
- **Gzip**: Nginx compresses JSON, HTML, CSS, JS
- **Lazy loading**: Frontend images load on demand
- **Debouncing**: Search waits 350ms to reduce API calls
- **Browser caching**: Static assets cached 7 days, HTML 1 day

## Security

- CORS restricted to frontend origin (not wildcard in production)
- Non-root container user
- Security headers (X-Content-Type-Options, X-Frame-Options)
- HTTPS enforced on load balancer
- API key stored in `.env` (never committed)
- Request timeouts prevent hanging connections
