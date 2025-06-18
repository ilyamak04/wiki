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

### Разворот кластера

Буду поднимать 1 мастер ноду, 2 воркер ноды, 1 вспомогательную (DNS, etc)

#### Поднимаем ВМ для кластера
!!! info "Я делаю всё от рута"

- `apt update && apt install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils` - устанавливаем гипервизор

- Создаём ВМ
```bash 
virt-install \
  --name k8s-master \
  --ram 4096 \
  --vcpus 3 \
  --disk path=/var/lib/libvirt/images/k8s-master.qcow2,size=20 \
  --os-variant ubuntu24.04 \         
  --network network=default \
  --graphics vnc,listen=127.0.0.1 \  
  --cdrom /var/lib/libvirt/images/ubuntu-24.04.2-live-server-amd64.iso \
  --noautoconsole
```

- `virsh vncdisplay k8s-master` - выводит VNC-дисплей, к которому привязан указанная гостевая ОС, если запущена

Пример вывода 
```bash
127.0.0.1:0
```

Значит порт: 5900 + 0

- `remote-viewer vnc://localhost:5900` - конфигурируем, устанвливаем ВМ
- `virsh list` - список запущенных ВМ
- `virsh start k8s-master` - запуск созданонй ВМ
- `virsh domifaddr k8s-master` - узнаём адрес ВМ
- `ssh ilyamak04@192.168.122.157` - ну и подключаемся по ssh

Аналогично поднимаем 2 воркер ноды, и 1 вспомогательную, не забываем менять выделяемые ресурсы для ВМ

#### Подготовка ВМ

- Откючаем `swap`, k8s требует отключенный swap для корректной работы планировщика
```bash
swapoff -a
```
!!! warn "Не забыть убрать запись из /etc/fstab"

Kubernetes использует cgroups для управления CPU и памятью контейнеров. Если включен swap, ядро может игнорировать лимит памяти, потому что будет сбрасывать часть данных в swap. Это нарушает работу OOM (Out Of Memory) killer и других механизмов kubelet'а. Когда swap включён, kubelet может не "увидеть", что контейнер превысил лимит памяти. Kubelet считает, что вся доступная память — это только RAM.

- Включаем модули ядра для корректной сетевой работы подов
```bash
tee /etc/modules-load.d/k8s.conf <<EOF 
overlay 
br_netfilter 
EOF
modprobe overlay 
modprobe br_netfilter 
```

- Для корректной маршрутизации сетевого трафика 
```bash
tee /etc/sysctl.d/k8s.conf <<EOF 
net.bridge.bridge-nf-call-ip6tables = 1 
net.bridge.bridge-nf-call-iptables = 1 
net.ipv4.ip_forward = 1 
EOF
# проверяем
sysctl --system
```

- Время на узлах должно быть синхронизировано, чтобы избежать проблем с сертификатами или ещё чего-нибудь
```bash
apt install -y chrony
```

- Проверить что ssh-сервис запущен
```bash
systemctl enable --now ssh
```

- Фаервол для простоты настройки можно отключить, но выставлять весь кластер в интернет очевидно плохая идея


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