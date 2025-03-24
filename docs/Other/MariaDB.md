### MariaDB

- `mysql -u [user] -p` - локальное подключение к серверу
- `mysql -h [host] -P [port] -u [user] -p` - удалённое подключение к серверу

---

- `SHOW DATABASES;` - показать все бд
- `CREATE DATABASE [db_name];` - создать бд
- `DROP DATABASE [db_name];` - удалить бд

---

- `USE [db_name];` - использовать бд
- `SHOW TABLES;` - показать таблицы
- `DROP TABLE [table_name];` - удалить таблицу
- `TRUNCATE TABLE [table_name];` - очистить таблицу (удалить все данные)
- `DESCRIBE [table_name]` или `SHOW COLUMNS FROM [table_name];` - структура таблицы 

---

- `CREATE USER 'username'@'localhost' IDENTIFIED BY 'password';` - создать пользователя, может коннектиться к базе только через `localhost`

- Права
```sql 
GRANT SELECT, INSERT ON [db_name].[table_name] TO 'username'@'localhost';
GRANT ALL PRIVILEGES ON [db_name].* TO 'username'@'localhost';
```
- `REVOKE INSERT ON [db_name].[table_name] FROM 'username'@'localhost';` - отозвать права
- `FLUSH PRIVILEGES;` - обновить права
- `RENAME USER 'user1'@'localhost' TO 'user1'@'192.168.1.100';` - изменить пользователя (имя, доступ с какого хоста)
- `DROP USER 'username'@'localhost';` - удалить пользователя
- `SELECT user, host FROM mysql.user;` - список пользователей и хостов

---

- Изменение таблицы
```
ALTER TABLE [table_name] ADD COLUMN [column_name] [data_type];
ALTER TABLE [table_name] DROP COLUMN [column_name];
```

- Пример запроса на чтение данных
```sql
SELECT * FROM [table_name];
SELECT column1, column2 FROM [table_name] WHERE condition;
-- Примеры условий:
WHERE id = 5;
WHERE created_at BETWEEN '2023-01-01' AND '2023-12-31';
WHERE column1 LIKE '%pattern%';
``` 

- Обновить данные
```sql
UPDATE [table_name] SET column1 = 'new_value' WHERE condition;
```

- Удалить данные
```sql
DELETE FROM [table_name] WHERE condition;
```

---

- Индексы
```sql
-- Создать индекс
CREATE INDEX [index_name] ON [table_name] (column1, column2); -- по умолчанию btree
-- Удалить индекс
DROP INDEX [index_name] ON [table_name];
```

---

- `mysqldump -u [user] -p [db_name] > backup.sql` - резервное копирование бд (`-p --all-databases` - все бд)
- `mysql -u [user] -p [db_name] < backup.sql` - восстановление бд

---

- `mariabackup --backup --user=[user] --password=[password] --target-dir=/backup/` - бэкап быстрее, бинарный формат, не блокирует таблицы, перед восстановлением необходимо завершить все транзации - `mariabackup --prepare --target-dir=/backup/`
- Восстановление бэкапа
```bash
sudo systemctl stop mariadb
sudo rm -rf /var/lib/mysql/*
mariabackup --copy-back --target-dir=/backup/
sudo chown -R mysql:mysql /var/lib/mysql
sudo systemctl start mariadb
```

---

- План выполнения запроса
```sql
EXPLAIN SELECT * FROM table_name WHERE column1 = 'value';
```

- Выполняет запрос и показывает фактический план выполнения с реальными метриками (время, количество строк и т.д.)
```sql
ANALYZE FORMAT=JSON SELECT * FROM table_name WHERE column1 = 'value';
```

- `SHOW PROFILE` Показывает профиль выполнения запроса 
```sql
SET profiling = 1;
SELECT * FROM table_name WHERE column1 = 'value';
SHOW PROFILE;
```

??? info "SHOW PROFILE"
    SHOW PROFILE — это инструмент для анализа времени выполнения отдельных этапов запроса. Показывает, сколько времени заняла каждая операция (например, парсинг, выполнение, отправка данных).

    +----------------------+----------+
    | Status               | Duration |
    +----------------------+----------+
    | starting             | 0.000123 |
    | checking permissions | 0.000045 |
    | Opening tables       | 0.000067 |
    | init                 | 0.000034 |
    | System lock          | 0.000023 |
    | optimizing           | 0.000056 |
    | executing            | 0.000078 |
    | Sending data         | 0.001234 |
    | end                  | 0.000045 |
    | query end            | 0.000034 |
    | closing tables       | 0.000023 |
    | freeing items        | 0.000045 |
    | cleaning up          | 0.000034 |
    +----------------------+----------+

- Показывает активные соединения и выполняемые запросы.
```sql 
SHOW FULL PROCESSLIST;
```

- Показывает статус InnoDB, включая информацию о блокировках, транзакциях и буферах.
```sql
SHOW ENGINE INNODB STATUS;
```

- Показывает статистику сервера
```sql
SHOW STATUS LIKE 'Innodb_buffer_pool_reads';
```

- Завершает выполнение запроса по его ID.
```sql
KILL [process_id];
```

- Перестраивает таблицу и освобождает неиспользуемое пространство.
```sql
OPTIMIZE TABLE table_name;
```

- Обновляет статистику для оптимизатора.
```sql
ANALYZE TABLE table_name;
```

- Проверяет целостность таблицы.
```sql
CHECK TABLE table_name;
```

--- 

- Логирование медленных запросов
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1; -- Запросы дольше 1 секунды
```

- Показывает статистику выполнения запросов.
```sql
SELECT * FROM performance_schema.events_statements_summary_by_digest;
```

---

#### Настройки 

- `SHOW VARIABLES;` - посмотреть текущие настройки

!!! info "Конфиги"
    Основной конфиг: `/etc/my.cnf` или `/etc/mysql/my.cnf`

    Дополнительные конфиги: `/etc/mysql/conf.d/` или `/etc/mysql/mariadb.conf.d/`

    Пример структуры:
    ```ini
    [mysqld]
    datadir = /var/lib/mysql
    bind-address = 0.0.0.0
    innodb_buffer_pool_size = 1G
    ```

!!! info "Логи"
    Общий лог: `/var/log/mysql/mysql.log` (логирует все запросы).

    Лог ошибок: `/var/log/mysql/error.log` (или `/var/log/mariadb/mariadb.log`)

    Бинарный лог (журнал транзакций): `/var/lib/mysql/mysql-bin.*` (включает все изменения данных)

    `mysqlbinlog /var/lib/mysql/mysql-bin.000001` - для просмотра бинарных логов

    Лог медленных запросов: `/var/log/mysql/mysql-slow.log`


!!! info ""
    По умолчанию данные лежат в `/var/lib/mysql/`

    Можно посмотреть в конфиге параметр `datadir`