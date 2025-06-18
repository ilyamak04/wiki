### YAML Синтаксис

#### Основные сущности 

- Скалярные значения
```yml
string_value: hello
number_value: 42
float_value: 3.14
boolean_true: true
boolean_false: false
```

- Списки (массивы)
```yml
servers:
  - web01
  - web02
  - db01
```
или
```yml
servers: [web01, web02, db01]
```

- Словари 
```yml
user:
  name: "ivan"
  age: 30
  admin: true
```
или
```yml
user: {name: ivan, age: 30, admin: true}
```

- Многострочные строки
```yml
description: |
  Это многострочный текст.
  Он сохраняет переносы строк.
  Полезно для документации.

command: >
  Это тоже многострочный текст,
  но переносы будут заменены пробелами.
```
- `|` - сохраняет всё как есть, включая `\n`
- `>` - склеивает строки в одну с пробелами

#### Расширенные возможности

- Ссылки и якори ($, *) 
```yml
defaults: &default_settings
  retries: 3
  timeout: 30

server1:
  <<: *default_settings
  timeout: 10  # переопределено

server2:
  <<: *default_settings
```

- Линтер
```yml
yamllint fine_name.yml
```

#### Разное

- Null
```yml
empty1: null
empty2: ~
empty3:
```

- Boolean
```yml
bool1: yes   # интерпретируется как true
bool2: no    # false
bool3: on    # true
bool4: off   # false
```
чтобы явно задать строку, необходимо использовать кавычки
```yml
literal_string: "yes"   # не будет true
```


### POD

k8s - кластерная ОС

POD - одно запущенное приложение в кластере k8s, минимальная абстракция k8s (внутри пода может быть несколько контейнеров, и в поде всегда минимум 2 контейнера: приложение, сетевой неймспейс) (контейнер внутри пода, как отдельный процесс в ОС)

- `kubectl create -f pod.yml` - создать под согласно конфигу из файла
- `kubectl get pod` - список подов 
- `kubectl describe pod <pod_name>` - описание объекта
- `kebectl delete pod <pod_name>` или `kubectl delete -f pod.yml` - удаление пода

```yml
# пример описания пода
---
apiVersion: v1 
kind: Pod # тип сущности
metadata:
  name: mypod # в рамках одного пространства имён имя уникально
spec: # описание объекта
  containers:
    - name: nginx
      image: nginx:latest
      ports:
        - containerPort: 80
```