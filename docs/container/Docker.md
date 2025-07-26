### Полезные источники 

- [**Базовые команды Docker**](https://github.com/python-dev-blog/docker-demo)
- [**Базовые команды docker-compose**](https://github.com/python-dev-blog/docker-compose-demo)
- [**Линтер для Docker**](https://github.com/hadolint/hadolint)

### Команды

- **`docker ps --format "{{.Names}}"`** - только имена контейнеров 

- `docker ps -s` - показать размеры контейнеров (`-l` - последний запущенный контейнер)
- `docker history <image_name>` - история создания образа (`--no-trunc` - не обрезать вывод)
- `docker volume ls` - список всех Docker томов на хосте
- `docker volume inspect <volume_name>` -  информацию о конкретном docker томе, например, его местоположение, размер и настройки и тп
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
