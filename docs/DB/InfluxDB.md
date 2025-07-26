### Influx1.x

- `unflux` - подключиться (`influx -ssl -host influx.mcarov.pro`)
- `show databases` - список бд
- `create database <db>` - создать бд
- `drop database <db>` - удалить бд 

---

- `USE mydb` - перейти в БД
- `SHOW MEASUREMENTS` - показать измерения 
- `SHOW FIELD KEYS` - показать все поля
- `SHOW TAG KEYS` - показать все 
- `SHOW TAG KEYS FROM "measurement_name"` - показать теги определенного измерения 
- `SHOW RETENTION POLICIES ON mydb` - посмотреть политики хранения на бд
- `CREATE RETENTION POLICY "one_week" ON mydb DURATION 7d REPLICATION 1`
- `ALTER RETENTION POLICY "one_week" ON mydb DURATION 14d`
- `DROP RETENTION POLICY "one_week" ON mydb`

---

- `SHOW USERS` - показать пользователей
- `CREATE USER username WITH PASSWORD 'password'` - создать пользователя
- `GRANT ALL PRIVILEGES TO username` - дать пользователю права администратора
- `GRANT READ ON mydb TO username` - дать права на базу данных
- `DROP USER username` - удалить пользователя

---

- `influxd backup -database mydb /path/to/backup` - резервное копирование бд 
- `influxd restore -database mydb /path/to/backup` - восстановление бд

#### HTTPS

- `influxdb.conf`
```conf
[http]
  # Determines whether HTTP endpoint is enabled.
  # enabled = true
  enabled = true
  bind-address = ":8086"
  https-enabled = true
  https-certificate = "/etc/letsencrypt/live/influx.mcarov.pro/fullchain.pem"
  https-private-key = "/etc/letsencrypt/live/influx.mcarov.pro/privkey.pem"
```

### Influx2.x

- `SHOW BUCKETS` - показать список бакетов
- `CREATE BUCKET mybucket` - создать бакет
- `DROP BUCKET mybucket` - удалить бакет 

- `SHOW MEASUREMENTS ON "mybucket"` - показать измерения в бакете
- `ALTER BUCKET mybucket SET RETENTION 7d` - политика хранения

- Записать данные через API
```bash
curl --request POST "http://localhost:8086/api/v2/write?org=my-org&bucket=my-bucket&precision=ns" \
  --header "Authorization: Token YOUR_API_TOKEN" \
  --data-raw "temperature,location=server1 value=25.6"
```

- Запрос данных через Flux
```
from(bucket: "my-bucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "temperature" and r.location == "server1")
  |> mean()
```

- `SELECT * FROM "mybucket"."autogen"."temperature" WHERE location = 'server1'` - если включен

- `influx auth list` - показать список токенов
- `influx auth create --org myorg --all-access` - создать токен
- `influx auth delete --id TOKEN_ID` - удалить токен

---

- `influx org list` - посмотреть список организаций
- `influx org create -n myorg` - создать организацию
- `influx org delete -n myorg` - удалить организацию

---

- `influx task list --org myorg` - просмотр списка задач 
- `influx task delete --id taskid` - удаление задачи

---

- `influxd backup -bucket mybucket /path/to/backup` - резервное копирование бд
- `influxd restore -bucket mybucket /path/to/backup` - восстановление бд
