### Полезные источники 

- [**Базовые команды Docker**](https://github.com/python-dev-blog/docker-demo)
- [**Базовые команды docker-compose**](https://github.com/python-dev-blog/docker-compose-demo)
- [**Линтер для Docker**](https://github.com/hadolint/hadolint)

### Команды

- **`docker ps --format "{{.Names}}"`** - только имена контейнеров 

- `docker ps -s` - показать размеры контейнеров (`-l` - последний запущенный контейнер)
- `docker logs -f --tail 100 my_app` - смотреть последние 100 строк и дальше в реальном времени
- `docker history <image_name>` - история создания образа (`--no-trunc` - не обрезать вывод)
- `docker volume ls` - список всех Docker томов на хосте
- `docker volume inspect <volume_name>` -  информацию о конкретном docker томе, например, его местоположение, размер и настройки и тп
- `docker system df` - посмотреть сколько места что занимает 
- `docker inspect <container_name> | grep -i volumes` - ищет информацию о томах, которые примонтированы к контейнеру
- `docker port <container_name>` - показывает маппинг портов
- `docker inspect <container_name> | grep -i port` - подробности о проброшенных портах
- `docker inspect <container_name> | grep -i mount` - показывает информацию о монтированиях (volumes, bind mounts, tmpfs)
??? tip "Монтирования в Docker"
    1. Named Volume - создаётся и управляется Docker. Хранится в `/var/lib/docker/volumes/`
    ```yaml
    services:
      db:
        image: postgres
        volumes:
        - db_data:/var/lib/postgresql/data
    volumes:
      db_data:
    ```
    
    2. Anonymous Volume - создаётся и управляется Docker. Хранится в `/var/lib/docker/volumes/`, но вместо имени хэш, например, `/var/lib/docker/volumes/2f4b7c3e8e1a7d9b8b12d34c7e4b1234/`
    ```yaml
    services:
      app:
        image: nginx
        volumes:
        - /usr/share/nginx/html

    3. Bind Mount - привязка к директории или файлу на хосте. Если мы прокидываем файл и его не существует Docker создаст каталог.
    ```yaml
    services:
      web:
        image: nginx
        volumes:
        - ./html:/usr/share/nginx/html:ro
    ```
    `:ro` - контейнеру том доступен только для чтения, по умолчанию доступен и на запись (`:rw`)

    4. Tmpfs Mount - данные хранятся в оперативке (RAM), а не на диске, при перезапуске, удалении контейнера данные будут потеряны.
    ```yaml
    services:
      cache:
        image: redis
        tmpfs:
        - /tmp
    ```

    5.  External Volume - внешний том, например, NFS.
    ```yaml
    services:
      app:
        image: nginx
        volumes:
        - nfs_data:/usr/share/nginx/html

    volumes:
      nfs_data:
        driver: local
        driver_opts:
          type: nfs
          o: addr=192.168.1.100,rw
          device: :/exported/path
    ```
 
 - `docker stats` - статистика по запущенным контейнерам
    - CONTAINER ID - Уникальный идентификатор контейнера.
    - NAME - Имя контейнера.
    - CPU % - Использование CPU в процентах.
    - MEM USAGE / LIMIT	- Использование памяти / установленный лимит.
    - MEM %	-   Доля использования памяти от лимита.
    - NET I/O - Сетевой ввод/вывод данных.
    - BLOCK I/O	- Объем операций ввода/вывода на диске.
    - PIDS	- Количество процессов внутри контейнера.

- `docker info` - инфа о докер (docker info --format '{{json .}}' - в json)

- Параметры для `restart`
    - `no` (или не указывать restart вовсе) — контейнер не будет перезапускаться автоматически. Это значение по умолчанию
    - `always` — контейнер будет автоматически перезапущен при любом завершении работы (даже при ручной остановке через docker stop). Он также перезапустится после перезагрузки Docker или хоста
    - `on-failure` — контейнер будет перезапущен только в случае выхода с ненулевым статусом (ошибкой). Вы можете также указать максимальное количество перезапусков, например,`on-failure:3`
    - `unless-stopped` — контейнер будет автоматически перезапущен при сбоях и после перезагрузки Docker или системы, но не перезапустится, если его остановили вручную.

### Разное

#### ARG

[Статья](https://www.docker.com/blog/docker-best-practices-using-arg-and-env-in-your-dockerfiles/)

`Аргументы сборки (ARG)` не сохраняются в конечном образе. ARG используется для передачи значений на этапе сборки. Эти значения доступны только во время сборки образа и не сохраняются в конечном образе. Также ARG не сохраняется в слоях образа, т.е. с помощью `docker history <image_name>:<tag>` значение переменной не посмотреть. Нельзя получить доступ к значению ARG из финального образа.

#### Как докер ищет образы? 

- Докер сначала проверяет есть ли образ с указанным именем и тегом локально на хосте (в кэше Docker)
- Если образ не найден локально, докер ищет его в registry по умолчанию, то есть в Dockerhub, Docker пытается спуллить образ с докер хаб, если тэг не указан, Docker использует тег `latest` по умолчанию
- Дальше Docker идет в настроенный Docker registry и ищет образ там, например, `image: registry.example.com/myimage:tag`
- Если образ не найден и в docker-compose.yml указана секция build, Docker создаст образ локально из Dockerfile, который находится в указанной директории. Пример в docker-compose.yml:
```yaml
services:
  myapp:
    build:
      context: .
      dockerfile: Dockerfile
```
Последовательность

1. Ищет локально на хосте.
2. Ищет на Docker Hub.
3. Ищет в частных реестрах (если указан).
4. Сборка из Dockerfile (если указана опция build в docker-compose.yml).

#### В чём разница сежду ENTRYPOINT и CMD

[Статья](https://www.docker.com/blog/docker-best-practices-choosing-between-run-cmd-and-entrypoint/)

ENTRYPOINT и CMD [] (без квадратных скобок оболочка будет использована) не использует оболочку для выполнения команды, команда передаётся напрямую процессу, то есть пайпы и всякие приблуды оболочки не работают
Docker не запускает оболочку, а передает команду напрямую в процесс. 

CMD можно переопределить при запуске контейнера
```bash
docker run image:tag comand
```
ENTRYPOINT задает команду, которая всегда будет выполняться при запуске контейнера. ENTRYPOINT используется для установки основной команды, которая должна быть выполнена, и она не может быть переопределена при запуске контейнера.

- `ENTRYPOINT` задаёт команду, которая всегда будет выполняться. Она не должна быть переопределена при запуске контейнера.
- `CMD` задаёт аргументы по умолчанию для `ENTRYPOINT`. Если `ENTRYPOINT` не указан, используется `CMD`, и `CMD` можно легко переопределить при запуске контейнера

```dockerfile
ENV MY_VAR=Hello
ENTRYPOINT ["sh", "-c", "echo $MY_VAR"]
```

```dockerfile
ENTRYPOINT ["nginx", "-g"]
CMD ["daemon off;"]
```

#### Хэлфчеки
 
Когда мы пишем 
```yaml
depends_on:
  postgresql-db:
    condition: service_healthy
```

Это значит что все хелфчеки к сервису (контейнеру) postgresql-db должны выполниться успешно, только после этого контейнер начнёт подниматься

#### &&

Оператор `&&` в командах оболочки используется для цепочки команд, где следующая команда выполняется только если предыдущая выполнилась успешно (с кодом возврата 0).

#### `>-` и `|-`

Когда нужно указать много переменных окружения в compose можно использовать `>-`

```
text: >-
  Это первая строка
  Это вторая строка
# РЕЗУЛЬТАТ
Это первая строка Это вторая строка
```
```
# Ещё пример
environment:   
  CATALINA_OPTS: >-
    -XX:+UseContainerSupport
    -XX:MaxRAMPercentage=80.0
    -server
    -XX:+UseParallelGC
    -Dfile.encoding=UTF-8
    -Djava.security.egd=file:/dev/./urandom
    -Dcom.sun.management.jmxremote
    -Dcom.sun.management.jmxremote.port=9000
    -Dcom.sun.management.jmxremote.rmi.port=9000
    -Dcom.sun.management.jmxremote.local.only=false
    -Dcom.sun.management.jmxremote.authenticate=false
    -Dcom.sun.management.jmxremote.ssl=false
    -Djava.rmi.server.hostname=
```

При использовании `|-` переносы строк сохраняются как есть
```
text: |-
  Это первая строка
  Это вторая строка
### РЕЗУЛЬТАТ
Это первая строка
Это вторая строка
```

#### Какие директивы докер не создают слои?

Слой появляется только тогда, когда инструкция меняет файловую систему образа

директивы которые не создают слой
```bash 
CMD, ENTRYPOINT, ENV, EXPOSE, LABEL, USER, VOLUME, STOPSIGNAL, HEALTHCHECK, ARG
```

#### Как работают слои?

Docker image состоит из набора неизменяемых слоёв, используется файловая система OverlayFS, которая объединяет слои
```bash
/var/lib/docker/overlay2/
```

Слой - это просто каталог с изменениями файлов, на Linux машине Docker хранит слои как каталоги с файлами
```bash 
overlay2/
 ├── 1a2b3c/
 ├── 4d5e6f/
 ├── 7g8h9i/
```

Каждый слой (каталог в `overlay2/`) - это изменение файловой системы относительно предыдущего слоя и OverlayFS умеет объединять все эти папки в одну файловую систему для контейнера

Слои неизменяемые, если команда меняется - создаётся новый слой, старый остаётся

Это нужно для:

- кеширования сборки
- повторного использования слоёв

Слой содержит diff файловой системы, а контейнер добавляет writable слой при запуске, все изменения пишутся туда

Если контейнер изменяет файл из нижнего слоя, файл копируется в writable layer, и изменяется копия файла (CoW)

Docker кеширует слои, если инструкция и её контекст не изменились, слой берётся из cache, поэтому важен порядок инструкций


Docker image - это типа стек immutable слоёв
```
base image
+ layer
+ layer
+ layer
------------------------
container writable layer
```

- слой = изменение файловой системы образа (Docker создаёт слой как diff файловой системы,
а OverlayFS объединяет слои в одну файловую систему, которую видит контейнер)
- слои immutable
- контейнер пишет только в верхний (writable) слой
- Docker использует copy-on-write при изменении файлов
- порядок инструкций сильно влияет на build cache
- удаление файлов в новом слое не уменьшает размер образа

### Ещё команды

- Команды
```bash 
docker build -t myapp:dev .
docker run -d --name myapp -p 5000:5000 myapp:dev
docker ps
docker ps -a
docker logs -f myapp
docker exec -it myapp sh
docker inspect myapp
docker stop myapp
docker rm myapp

docker compose up --build
docker compose up -d
docker compose down
docker compose ps
docker compose logs -f
docker compose exec app sh
docker compose config

docker compose stop 
docker compose start

docker run -it --rm python:3.13-slim bash
docker stats
```

- Остановка внутри сборки Dockerfile
```
RUN apt update && apt install -y curl
RUN sleep infinity
```

---

#### Пример контейнеризации

- Питонячье приложение
```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_HOME=/app

WORKDIR ${APP_HOME}

RUN groupadd --system appgroup \
    && useradd --system --gid appgroup --create-home --home-dir ${APP_HOME} appuser

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN chown -R appuser:appgroup ${APP_HOME}

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4", "--timeout", "30", "app:app"]
```

- Приложение на Golang
```dockerfile
FROM golang:1.24 AS builder

WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY main.go ./

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-s -w" -o /out/go-app .

FROM alpine:3.20

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /out/go-app /app/go-app

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 || exit 1

CMD ["/app/go-app"]
```

- Конфиг Nginx
```conf 
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /dev/stdout;
    error_log /dev/stderr warn;

    upstream python_upstream {
        server python-app:8000;
        keepalive 16;
    }

    upstream go_upstream {
        server go-app:8080;
        keepalive 16;
    }

    server {
        listen 8080;
        server_name _;

        location = /health {
            access_log off;
            return 200 'ok';
            add_header Content-Type text/plain;
        }

        location /python/ {
            proxy_pass http://python_upstream/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /go/ {
            proxy_pass http://go_upstream/;
            proxy_http_version 1.1;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

- Композ 
```
services:
  python-app:
    build:
      context: ./python-app
      dockerfile: Dockerfile
    environment:
      APP_ENV: prod
    expose:
      - "8000"
    read_only: true
    tmpfs:
      - /tmp:size=64m,noexec,nosuid,nodev
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    restart: unless-stopped
    mem_limit: 256m
    cpus: 0.50
    pids_limit: 100
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 15s
    networks:
      - backend

  go-app:
    build:
      context: ./go-app
      dockerfile: Dockerfile
    environment:
      APP_ENV: prod
    expose:
      - "8080"
    read_only: true
    tmpfs:
      - /tmp:size=32m,noexec,nosuid,nodev
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    restart: unless-stopped
    mem_limit: 128m
    cpus: 0.50
    pids_limit: 80
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8080/health"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - backend

  nginx:
    image: nginx:1.27-alpine
    depends_on:
      python-app:
        condition: service_healthy
      go-app:
        condition: service_healthy
    ports:
      - "8080:8080"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    restart: unless-stopped
    mem_limit: 128m
    cpus: 0.25
    pids_limit: 100
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/health >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 10s
    networks:
      - backend

networks:
  backend:
    driver: bridge
```

> хэлфчеки нужно указывать либо в композ, либо в докерфайле (указал и там, и там для примера)