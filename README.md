<<<<<<< HEAD
## MovieStream — Movie Ratings + Trailers Web App
A web application using FastAPI & HTML,CSS,JS that allows users to browese movies filtering by genre, search, sort and watch official Youtube trailors. The web app is using an API `The Movie Database(TMDB) API`.
In this project we also included docker deployment, Nginx reverse proxy, and is ready for deployment on the school provided servers using load balancer server. 

## The link to the site deployed on my school servers 
- `www.jonaintra.tech/movies/`

## Youtube video link
- ` `

## Features 
> Movie Features
- Search movies
- Filter by genre
- Sort by:
   - Popularity
   - Latest releases
   - Highest rated
- View official YouTube trailers
- View movie posters and summaries

> Technical Features
- FastAPI backend with async HTTP requests
- Caching using TTLCache (600 seconds)
- Secure .env for API key
- Full Docker containerization
- Nginx load balancing support
- Clean, responsive frontend UI

## Project Structure 
movie_web/
│── backend/
│     ├── main.py
│     ├── requirements.txt
│     └── .env     (ignored in git)
│
│── frontend/
│     ├── index.html
│     ├── styles.css
│     └── scripts.js
│
│── nginx/
│     └── default.conf
│
│── venv/              (ignored)
│── docker-compose.yml
│── Dockerfile
│── .dockerignore
│── .gitignore

## Backend 
# 1. TMDB API
The backend loads your API key from .env: `TMDB_API_KEY=your_key_here`
> It uses The Movie Database endpoints for:
 - Genres
 - Movie Search
 - Discover movies
 - Fetching Youtube trailors

# 2. Caching (TTLCache)
> To reduce API calls and improve performance:
```
genres_cache  → stores movie genre list  
movies_cache  → caches searches  
videos_cache  → caches trailers per movie  
```
# 3. API Endpoints
A. Get all genres:
- `GET /api/genres`
B. Search or discover movies:
- `GET /api/movies?q=$genre=$sort=$page=`
and also supports:
 - search text
 - genre filtering
 - sorting
 - pagination
C. Get official youtube trailors
- `GET /api/movies/{movie_id}/videos`

## Docker Deployment guide
1. Build and run containers locally
`docker-compose up --build`
- Backend runs on port 8000
- Frontend served via nginx on port 80
2. Stop containers 
`docker-compose down`

## Deployment on school web servers
> web-01, web-02 and lb-01 
On both web-01 and web-02:
 > Copy the file project only file project no the virtual environment or python just the files:
 - `scp -i ~/.ssh/<private_key> backend frontend ubuntu@<IP_web01/02>:~/movie_web`
 > Create a file and write in the code for installing python3 and install all requirements.txt file but first create manually a virtual environment to install all depencies
 > create a moviestream system to be running under this file path: `/etc/systemd/system/moviestream.service` this file will contain: 
 ```
 [Unit]
Description=MovieStream FastAPI backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/movie_web
Environment="PATH=/home/ubuntu/movie_web/venv/bin"
ExecStart=/home/ubuntu/movie_web/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
 ```
This file it's purpose is to run and manage my fastapi backend as a background service that automatically start,stops and restart the web application. It will be running automatically in the backeground of the twoo servers, Restart automatically if it crashes, starts automatically when system boots

> Create an nginx file: `/etc/nginx/sites-available/moviestream`
Here are it's components:
```
ubuntu@6725-web-01:~$ sudo cat /etc/nginx/sites-available/moviestream
server {
    listen 80;
    server_name web-01/02.<domain_name> <domain_name>;

    root /home/ubuntu/movie_web/frontend;
    index index.html;

    location /movies/ {
        alias /home/ubuntu/movie_web/frontend/;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location = /movies/ {
        return 302 /lander;
    }

    # Proxy API requests to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
- Here this file is listening on servers domains the subdomain and domain name with ssl 

- Here are some codes to start the movie stream app:
> sudo systemctl enable moviestream.service
> sudo systemctl start moviestream.service
> sudo systemctl status moviestream.service

- Vie logs in real time:
`sudo journalctl -u moviestream.service -f` It will help in debbuging and monitoring.

> If the app has some issues and you fix the code better to follow this:
- `sudo systemctl dameon-reload`
- `sudo systemctl status moviestream.service`
# lb-01 file 
Under the file `/etc/haproxy/haproxy.cfg`: 
Add in this :
```
# frontend http->https

frontend http_front
    bind *:80
    mode http
    redirect scheme https code 301 if !{ ssl_fc }


frontend https_front
    bind *:443 ssl crt /etc/ssl/private/domain_name.pem
    mode http

    # movie app routing
    acl is_movie_app path_beg /movies
    acl host_domain hdr(host) -i domain_name
    use_backend movies_backend if host_domain is_movie_app


    default_backend web_servers


# Backend
backend web_servers
    balance roundrobin
    server web-01 <IP_Address>:80 check
    server web-02 <IP_Address>:80 check
    http-response set-header X-Served-By %[srv_name]

backend movies_backend
    balance roundrobin
    server web-01 <IP_Address>:80 check
    server web-02 <IP_Address>:80 check
    http-response set-header X-Served-By %[srv_name]
```
> On all the servers you must already have installed nginx (web-01&02), and haproxy on lb-01 
=======
# Playing_with_APIs
Learn manipulation and use of external apis and documentation
>>>>>>> e537893b37f532e19d0b920b04d19e75b6024a1c
