### Полезные ссылки

[Cheat sheet](https://gist.github.com/Kartones/dd3ff5ec5ea238d4c546)

### Команды

- `sudo -u postgres psql postgres` - подключиться к базе данных `postgres` от имени пользователя Linux `postgres`
!!! tip ""
    `sudo -u postgres psql`

    Если не указано имя базы данных при подключении, `psql` попытается подключиться к базе данных с именем, совпадающим с именем пользователя. В данном случае это будет база данных postgres
- `sudo -u postgres psql -d имя_базы_данных -f путь_к_скрипту.sql` - выполнить SQL-скрипт на базе
- `sudo -u postgres psql -d имя_базы_данных -c "SQL-запрос"` - выполнить SQL-скрипт на базе

!!! tip "Команды `psql` начинаются с `\`"

- `\l` - просмотр списка БД
- `\du` - посмотреть какие роли назначены пользователю
- `\q` - выход из psql
- `\e` - открывает текстовый редактор для написания SQL-запроса
- `\c <database_name> <user_name>` - подключение к БД или из bash `psql -U username -d <database_name>`
- `\dt` - просмотр списка таблиц
- `\d <table_name>` - показывает столбцы, типы данных и индексы
- `\dn` - список схем
- `\dt <schema_name>` - список таблиц в схеме
- `psql -U postgres -d my_database -f /etc/script.sql` - выполнить скрипт

---

- `CREATE TABLE имя_таблицы (id SERIAL PRIMARY KEY, колонка1 тип, колонка2 тип, ...);` - создание таблицы
- `CREATE USER имя_пользователя WITH PASSWORD 'пароль';`
- `CREATE ROLE имя_роли;`
??? info "В чём разница USER и ROLE?"
    Пользователь (USER) — это роль, которая по умолчанию ИМЕЕТ право на подключение к базе данных
    Роль (ROLE) — это более общее понятие. Она может быть как пользователем, так и группой. Роль по умолчанию НЕ ИМЕЕТ права на подключение к базе данных (если не указан атрибут LOGIN)

    Роли (и пользователи) могут иметь дополнительные атрибуты, которые определяют их поведение. Вот основные атрибуты:

        - `LOGIN` - Позволяет роли подключаться к базе данных (по умолчанию для USER)
        - `SUPERUSER` - Дает роли права суперпользователя
        - `CREATEDB` - Позволяет роли создавать базы данных
        - `CREATEROLE` - Позволяет роли создавать другие роли
        - `INHERIT` - Позволяет роли наследовать права от других ролей (по умолчанию TRUE)
        - `REPLICATION`- Позволяет роли использоваться для репликации
        - `PASSWORD` - Устанавливает пароль для роли

    ```sql
    CREATE ROLE admin WITH LOGIN PASSWORD 'password' CREATEDB CREATEROLE
    ```

    Пользователя (USER) можно добавить в роль (ROLE). Когда пользователь добавляется в роль, он автоматически наследует все права, связанные с этой ролью.

    ```sql
    -- Создаем роль
    CREATE ROLE read_only;
    -- Создаем пользователя
    CREATE USER myuser WITH PASSWORD 'password';
    -- Добавляем пользователя в роль
    GRANT read_only TO myuser;
    ```
    ```sql
    -- удалить пользователя из роли
    REVOKE имя_роли FROM имя_пользователя;
    ```
- `GRANT ALL PRIVILEGES ON DATABASE имя_базы TO имя_пользователя;`
- `DROP USER имя_пользователя;`
- `DROP ROLE имя_роли;`
- `ALTER TABLE` — это команда в SQL, которая используется для изменения структуры уже существующей таблицы в базе данных.
```sql
ALTER TABLE имя_таблицы ADD имя_столбца тип_данных;
```
```sql
ALTER TABLE имя_таблицы DROP COLUMN имя_столбца;
```
```sql
ALTER TABLE имя_таблицы ALTER COLUMN имя_столбца SET DATA TYPE новый_тип;
```
```sql { .code-wrap }
ALTER TABLE имя_таблицы ADD CONSTRAINT имя_ограничения тип_ограничения (столбец);
```
```sql
ALTER TABLE employees ADD CONSTRAINT age_check CHECK (age >= 18);
```
```sql
ALTER DATABASE "<old_name>" RENAME TO "<new_name>";
```
```sql
-- какие роли назначены пользователю
SELECT rolname, memberof 
FROM pg_roles 
WHERE rolname = 'myuser';
```
--- 

```sql
-- отключить все подключения к бд
SELECT pg_terminate_backend( pid ) 
FROM pg_stat_activity 
WHERE pid <> pg_backend_pid( ) AND datname = '<database_name>'; 
```
```sql
-- убить подключение по pid
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <process_id>;
```

#### Статистика

- `SELECT * FROM pg_stat_activity;` - просмотр текущий подключений
- `SELECT * FROM pg_locks;` - просмотр блокировок
 
```sql
-- просмотр текущих подключений подробно
SELECT 
    pid,                                       -- Идентификатор процесса
    state,                                     -- Состояние процесса
    now() - query_start AS query_runtime,      -- Время выполнения текущего запроса
    now() - xact_start AS transaction_runtime, -- Время выполнения транзакции
    application_name,
    query,                                     -- Текущий запрос
    usename,                                   -- Пользователь
    datname,                                   -- База данных
    xact_start                                 -- Время начала транзакции
FROM pg_stat_activity
WHERE state IN ('active', 'idle in transaction') and datname = current_database()         
ORDER BY transaction_runtime DESC;   
```
```sql
-- смотрим базы и их размер
SELECT pg_database.datname,
       pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
ORDER BY pg_database_size(pg_database.datname) DESC;
```
```sql
-- общий размер конкретной БД
select pg_size_pretty(pg_database_size('название базы'));
```
```sql
-- общий размер индекса в БД
SELECT
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_index_size
FROM
    pg_stat_all_indexes;
```
```sql
-- размер таблиц в БД
SELECT
    schemaname AS table_schema,
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_table_size(relid)) AS data_size,  
    pg_size_pretty(pg_indexes_size(relid)) AS index_size
FROM
    pg_catalog.pg_statio_user_tables
ORDER BY
    pg_total_relation_size(relid) DESC,
    pg_table_size(relid) DESC;
```
```sql
-- размер индексов в БД
SELECT
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_index_size
FROM
    pg_index
JOIN
    pg_class ON pg_index.indexrelid = pg_class.oid
WHERE
    pg_class.relkind = 'i';
```
```sql
-- общий размер индексов в таблице
SELECT
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_index_size
FROM
    pg_stat_all_indexes
WHERE
    relname = 'название таблицы';
```
```sql
-- имя индексов в таблице и скрипт которым создан индекс
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'table_name';
```
```sql
-- блокировки в БД
SELECT 
 blocked_locks.pid AS blocked_pid,
 blocked_activity.usename AS blocked_user,
 blocking_locks.pid AS blocking_pid,
 blocking_activity.usename AS blocking_user,
 blocking_activity.state AS blocking_state,
 blocked_activity.query AS blocked_statement,
 blocking_activity.query AS current_statement_in_blocking_process,
 blocked_locks.locktype AS blocked_locktype, 
 blocking_locks.locktype AS blocking_locktype
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity 
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
 AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
 AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
 AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
 AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
 AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
 AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
 AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
 AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
 AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
 AND blocking_locks.pid != blocked_locks.pid 
JOIN pg_catalog.pg_stat_activity blocking_activity 
  ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```
```sql
select * from pgstats where tablename = '<table_name>' and attname = '<att_name>'
```
```sql
-- использование памяти и ресурсов в БД
SELECT *
FROM pg_stat_database;
```
??? info "Расшифровка атрибутов `pg_stat_database`"
    - `datid` — Идентификатор базы данных (OID).
    - `datname` — Имя базы данных.
    - `numbackends` — Количество активных соединений (клиентов) с этой базой.
    - `xact_commit` — Общее количество успешно завершённых транзакций.
    - `xact_rollback` — Общее количество откатов транзакций.
    - `blks_read` — Количество блоков, считанных с диска.
    - `blks_hit` — Количество блоков, найденных в кеше (попадания в shared_buffers).
    - `tup_returned` — Количество строк, возвращённых клиенту.
    - `tup_fetched` — Количество строк, извлечённых (например, SELECT).
    - `tup_inserted` — Количество вставленных строк (INSERT).
    - `tup_updated` — Количество обновлённых строк (UPDATE).
    - `tup_deleted` — Количество удалённых строк (DELETE).
    - `conflicts` — Количество конфликтов (например, из-за репликации).
    - `temp_files` — Количество временных файлов, созданных сервером.
    - `temp_bytes` — Количество данных, записанных во временные файлы (в байтах).
    - `deadlocks` — Количество взаимоблокировок.
    - `blk_read_time` — Общее время чтения блоков с диска (в миллисекундах).
    - `blk_write_time` — Общее время записи блоков на диск (в миллисекундах).

### Бэкапирование

По умолчанию pg_dump создает логический бэкап в формате plain (обычный SQL-скрипт)

В PostgreSQL есть два типа дампов:

- `Физические (pg_basebackup)` — побайтовая копия файлов БД.
- `Логические (pg_dump, pg_dumpall)` — SQL-скрипты или архивные файлы.

!!! info ""
    `pg_dumpall` создает резервную копию всех баз данных, роли (пользователи и группы), права доступа (GRANT/REVOKE), настройки tablespace, глобальные параметры (например, настройки аутентификации). Умеет отдавать только дамп в формате .sql

    `pg_dump` не экспортирует роли, права доступа, tablespaces, параметры кластера (например, `pg_hba.conf`)

1. plain (Текстовый SQL-скрипт)

Описание:

В этом формате по дефолту снимает `pg_dump`. Формат plain представляет собой обычный SQL-скрипт, содержащий скрипты `CREATE TABLE`, `INSERT INTO`, `ALTER TABLE` и другие скрипты для создания и наполнения бд .

Дамп в формате `plain`:
```bash
pg_dump -U postgres -d mydatabase -Fp -f backup.sql
```
Пример содержимого файла дампа:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT
);
INSERT INTO users (id, name) VALUES (1, 'Alice');
```

- Можно редактировать в текстовом редакторе.

- Можно восстановить частично, скопировав нужные команды.

- Относительно долгое восстановление, так как все данные вставляются скриптами.

Как восстановить:
```bash
psql -U postgres -d mydatabase -f backup.sql
```

2. custom (Сжатый бинарный формат)

Описание:

Формат custom является бинарным, поддерживает сжатие и позволяет восстанавливать отдельные объекты базы данных, такие как таблицы и схемы.

Как создать дамп в формате `custom`:
```bash
pg_dump -U postgres -d mydatabase -Fc -Z 9 -f backup.dump
```
Параметры:

- `Fc` - указывает на использование формата custom.
- `Z 9` - применяет максимальное сжатие дампа.
- `-a` или `--data-only`: Дамп только данных, без схемы
- `-s` или `--schema-only`: Дамп только схемы, без данных
- `-O` или `--no-owner`: Исключает команды SET OWNER из дампа   
- `-x` или `--no-privileges`: Исключает команды GRANT/REVOKE из дампа.

- Поддерживает выборочное снятие отдельных объектов.
- Поддерживает параллельное снятие с `-j`.

Посмотреть содержимое дампа без восстановления:
```bash
pg_restore -l backup.dump
```

Как восстановить базу данных:
```bash
pg_restore -U postgres -d mydatabase -f backup.dump
```

3. directory (Каталог с дампом)

Описание:

Формат `directory` сохраняет резервную копию в виде каталога, содержащего отдельные файлы для каждой таблицы и других объектов базы данных. Этот формат позволяет параллельно снимать бэкап.

Дамп в формате `directory`:

```bash
pg_dump -U postgres -d mydatabase -Fd -j4 -f backup_dir/
```

Параметры:

- `Fd` — указывает на формат directory.
- `j4` — использует 4 параллельных потока для ускорения процесса.

- Можно восстанавливать отдельные таблицы и объекты.

Восстановление
```bash
pg_restore -U postgres -d mydatabase -j 4 backup_dir/
```

4. tar (Архив tar)
Описание:

Формат tar создает архив tar, содержащий все необходимые файлы для восстановления базы данных. Он удобен для хранения и передачи, но восстановление в данном формате выполняется медленнее по сравнению с `directory` или `custom`.

Дамп в формате `tar`:
```bash
pg_dump -U postgres -d mydatabase -F t -f backup.tar
```
Параметры:

- Ft — указывает на формат tar.
- Медленное восстановление, так как данные сначала извлекаются из архива.

Восстановление бд:
```bash
pg_restore -U postgres -d mydatabase -Ft backup.tar
```

!!! info ""
    Все форматы дампов кроме `.sql` восстанавливаются через `pg_restore`


#### Пример организации бэкапирования

Скрипт `backup.sh` для снятия бэкапа, удаления бэкапов
```bash
#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Необходимо передать три аргумента."
    echo "Пример: $0 <имя_стенда> <имя_базы_данных> <время_жизни_бэкапа_в_днях>"
    exit 1
fi

PG_PASSWORD="postgres"
PG_PORT="5432"
STAND_NAME="$1"
DB_NAME="$2"
BACKUP_TTL="$3"
BACKUP_DIR="/opt/backups/${STAND_NAME}"
BACKUP_FILE="${STAND_NAME}_$(date +%Y%m%d).dump"
LOG_DIR="${BACKUP_DIR}/logs"
LOG_FILE="${LOG_DIR}/backup_${STAND_NAME}.log"

mkdir -p "${BACKUP_DIR}"
mkdir -p "${LOG_DIR}"

echo "$(date +%Y%m%d_%H%M%S) Начало резервного копирования базы данных ${DB_NAME}" >> ${LOG_FILE}

PGPASSWORD=${PG_PASSWORD} pg_dump -p ${PG_PORT} -h localhost -U postgres -d ${DB_NAME} -Fc -Z 9 -f "${BACKUP_DIR}/${BACKUP_FILE}" 2>> ${LOG_FILE}

if [ $? -eq 0 ]; then
    echo "$(date +%Y%m%d_%H%M%S) Резервное копирование успешно завершено: ${BACKUP_DIR}/${BACKUP_FILE}" >> ${LOG_FILE}

    find ${BACKUP_DIR} -type f -name "*.dump" -mtime +${BACKUP_TTL} -exec rm {} \;

    if [ $? -eq 0 ]; then
        echo "$(date +%Y%m%d_%H%M%S) Бэкапы старше ${BACKUP_TTL} дней удалены." >> ${LOG_FILE}
    else
        echo "$(date +%Y%m%d_%H%M%S) Ошибка при удалении бэкапов." >> ${LOG_FILE}
    fi

else
    echo "$(date +%Y%m%d_%H%M%S) Ошибка при резервном копировании базы данных ${DB_NAME}" >> ${LOG_FILE}
fi
```

Добавить в `cron`

```bash
# Для снятия бэкапа: <путь к скрипту> <имя каталога для бэкапа> <имя базы данных стенда> <кол-во хранимых бэкапов>
00 23 * * * /opt/backups/backup.sh stand1 database1 3
59 23 * * * /opt/backups/backup.sh stand2 database2 3
```

### Разное

- `ps -ef | grep -v grep | grep postgres` - определяет есть ли процесс постгрес на машине 
- `which psql` - есть ли в локальном окружении psql
- `sudo docker inspect <имя_контейнера> | grep postgres` - есть ли постгрес в контейнере
---
- `psql -U postgres -c "SHOW server_version;"` - версия пг или `psql -V` или `/usr/bin/psql -V`
- `psql -U postgres -c "SHOW port;"` - порт на котором работает пг 
- `psql -U postgres -c "SHOW wal_directory;"` - каталог WAL


#### Где что лежит??

1. Каталог данных
    - `/var/lib/postgresql/<версия>/main/` - Debian/Ubuntu
    - `/var/lib/pgsql/<версия>/data/` - CentOS/Fedora
    - `psql -U postgres -c "SHOW data_directory;"`
2. Конфигурационные файлы (могут находится в каталоге данных)
    - `/etc/postgresql/<версия>/main/`
    - `psql -U postgres -c "SHOW config_file;"` - путь к конфигу
    - `psql -U postgres -c "SHOW hba_file;"` - путь к настройкам аутентификации
3. Каталог логов
    - `/var/log/postgresql/`
    - `psql -U postgres -c "SHOW log_directory;"`
--- 

- `SHOW shared_preload_libraries;` - список библиотек, которые были загружены при старте PostgreSQL с помощью параметра `shared_preload_libraries` в `postgresql.conf` 
- `pg_config --pkglibdir` -  показывает путь к каталогу, где находятся библиотеки пг (shared libraries).

### Настройка репликации Master-Slave

- `apt install postgresql postgresql-contrib -y` - устанавливаем СУБД на обе машины
- `systemctl status postgresql`

#### Настройка Master
```conf
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost,150.241.66.94' # 150.241.66.94 адрес ВМ, на которой slave
wal_level = replica # минимальный уровень необходимый для репликации
max_wal_senders = 5 # максимальное количество подключений для передачи WAL, максимум 5 слейвов 
wal_keep_size = 1024MB
hot_standby = on # разрешаем селекты с реплики, по умолчанию нельзя
archive_mode = on # включаем архивирование WAL
archive_command = 'find /var/lib/postgresql/16/main/archive -type f -mtime +7 -delete; gzip < %p > /var/lib/postgresql/16/main/archive/%f.gz'
```

```
# /etc/postgresql/16/main/pg_hba.conf
# файл pg_hba.conf (Host-Based Authentication) управляет доступом к PostgreSQL, определяя, какие пользователи могут подключаться
# c каких IP-адресов и каким способом аутентификации

host    replication     replicator      192.168.1.2/32           scram-sha-256
```

Создадим роль для репликации, выполнить:

```bash
sudo -u postgres psql
```
```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '<password>'; 
```
```sql
\q
```
Открыть «MASTER» базу данных, выполнить скрипт на обновление информации о настройках доступа из файла `pg_hba.conf`:
SELECT pg_reload_conf();

??? info "Сжатый WAL"
    PostgreSQL не умеет автоматически разархивировать сжатые WAL-файлы.
    Если WAL-логи в сжатом формате (.gz), то перед восстановлением их нужно разархивировать вручную в `restore_command`.

    Если archive_command на master сжимает WAL при архивации, например:

    archive_command = 'gzip < %p > /var/lib/postgresql/archive/%f.gz'

    То restore_command на slave должен разархивировать WAL перед восстановлением:

    restore_command = 'gunzip -c /var/lib/postgresql/archive/%f.gz > %p'

    Как это работает?

    restore_command ищет запрашиваемый WAL-файл в архиве.
    Если он найден в сжатом виде (.gz), команда gunzip -c разархивирует его в нужное место (%p).

    slave применяет этот WAL-файл и продолжает репликацию.

#### Настройка Slave

По умолчанию реплику (slave) нельзя записывать данные, потому что она работает в режиме только для чтения (read-only), на то она и слейв реплика.

```bash
sudo systemctl stop postgresql
```
```bash
sudo -u postgres rm -rf /var/lib/postgresql/16/main/*
```
```bash
sudo -u postgres pg_basebackup -h 192.109.139.92 -U replicator -D /var/lib/postgresql/16/main -P -R --wal-method=stream` # 192.109.139.92 - ip мастера
```

Если файл standby.signal присутствует в директории данных ($PGDATA) при запуске PostgreSQL, сервер не будет принимать записи и будет получать данные с Master.
Он создаётся автоматически при запуске pg_basebackup с флагом -R или вручную.
Если удалить standby.signal и перезапустить PostgreSQL, сервер станет обычным Master (потеряет связь с репликой).

После выполнения pg_basebackup в `/var/lib/postgresql/16/main/` на Slave должен появиться файл standby.signal. Он сообщает PostgreSQL, что сервер работает как Standby (slave).

```bash
sudo systemctl start postgresql
```
```bash
sudo systemctl status postgresql
```
```sql
# проверить репликацию на мастере 
SELECT * FROM pg_stat_replication;
```
```sql
# проверить репликацию на слейве
SELECT * FROM pg_stat_wal_receiver; 
```

На slave после окончания загрузки бд и запуска postgres проверить наличие файла `/var/lib/pgsql/16/data/standby.signal`, а также наличие строки подключения к серверу master в файле `/var/lib/pgsql/16/data/postgresql.auto.conf`

Открыть master базу данных, выполнить скрипт на проверку состояния репликации (скрипт должен вернуть строку, в поле «state» должно быть значение «streaming»)
```sql
select * from pg_stat_replication;
```

Открыть slave базу данных, выполнить скрипт на проверку состояния репликации (скрипт должен вернуть строку, в поле «status» должно быть значение «streaming»)
```sql
select * from pg_stat_wal_receiver;
```
