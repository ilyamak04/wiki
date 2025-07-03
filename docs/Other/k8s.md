### Ссылки

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
- `virsh list --all` - список запущенных ВМ
- `virsh start k8s-master` - запуск созданонй ВМ
- `virsh domifaddr k8s-master` - узнаём адрес ВМ
- `ssh ilyamak04@192.168.122.157` - ну и подключаемся по ssh

Аналогично поднимаем 2 воркер ноды, и 1 вспомогательную, не забываем менять выделяемые ресурсы для ВМ

??? info "Дополнительные команды для управления ВМ"
    - `virsh shutdown <vm-name>` - штатное выключение ВМ
    - `virsh destroy <vm-name>` - жёсткое выключение, например, если ВМ зависла, НЕ УДАЛЯЕТ ВМ
    - `virsh list --all` - показать список всех виртуальных машин (включая выключенные)
    - `virsh start <vm-name>` - запустить виртуальную машину
    - `virsh undefine <vm-name>` - удалить ВМ из libvirt (не удаляет диск в /var/lib/libvirt/images/)
    - `virsh domifaddr <vm-name>` - показать IP-адрес ВМ (если доступен)
    - `virsh dumpxml <vm-name>` - вывести XML-конфигурацию ВМ
    - `virsh console <vm-name>` - подключиться к консоли ВМ (если настроен serial-порт)
    - `virsh domstate <vm-name>` - показать текущее состояние ВМ
    - `virsh autostart <vm-name>` - включить автозапуск ВМ при старте хоста
    - `virsh autostart --disable <vm-name>` - отключить автозапуск ВМ
    - `virsh net-list` - список виртуальных сетей libvirt
    - `virsh net-dumpxml default` - показать XML-конфигурацию сети default
    - `virsh dumpxml <vm-name>` - посмотреть XML-конфиг ВМ
    - `virsh net-edit default` - отредактировать настройки сети (например, static DHCP)
    - Клонировать ВМ
    ```bash
    # hostname на клонированной вм нужно менять вручную
    virt-clone \   
    --original k8s-worker1 \
    --name k8s-worker2 \
    --file /var/lib/libvirt/images/k8s-worker2.qcow2
    ```

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
# перечитываем конфигурации, применяем
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

- Добавим репозиторий docker для установки containerd, Kubernetes не запускает контейнеры напрямую, он использует Container Runtime Interface (CRI), который реализует containerd
```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/trusted.gpg.d/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y containerd.io
```

- Kubernetes требует, чтобы containerd использовал systemd как управляющий механизм cgroups, т.е. структуру контроля ресурсов (CPU, память и т.п.)
```bash
containerd config default | tee /etc/containerd/config.toml  
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd
```

- Добавим репозиторий k8s, установим необходимые компоненты k8s
```bash
# Добавить GPG-ключ
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

# Добавить репозиторий Kubernetes
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Обновить список пакетов
apt update

# Установить kubeadm, kubelet, kubectl
apt install -y kubelet kubeadm kubectl

# Заблокировать от автоматического обновления
apt-mark hold kubelet kubeadm kubectl

###
# Проверка
###
kubeadm version
kubelet --version
kubectl version --client
```

- Установим `crictl` для взаимодействия с `containerd` (удобно для отладки)
```bash
VERSION="v1.30.0"
curl -LO https://github.com/kubernetes-sigs/cri-tools/releases/download/$VERSION/crictl-$VERSION-linux-amd64.tar.gz
sudo tar -C /usr/local/bin -xzf crictl-$VERSION-linux-amd64.tar.gz
rm crictl-$VERSION-linux-amd64.tar.gz
```
```bash
cat <<EOF | sudo tee /etc/crictl.yaml
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: "unix:///run/containerd/containerd.sock"
timeout: 0
debug: false
pull-image-on-create: false
disable-pull-on-run: false
EOF
```

- Добавим алиас для команды `kubectl`
```bash
echo "alias k='kubectl'" >> ~/.bashrc
source ~/.bashrc
```

- Базовые команды
```bash
crictl info                      # информация о рантайме
crictl ps -a                    # список всех контейнеров
crictl images                   # список всех образов
crictl pods                     # список подов
crictl logs <container_id>      # логи контейнера
```

- Автодополнение для `kubectl`
```bash
source <(kubectl completion bash)
echo "source <(kubectl completion bash)" >> ~/.bashrc
```

#### DNS-сервер

Данный DNS-сервре настраивается для коммуникации между нодами (серверами), для организации резолва имен между сущностями кубера, кубер использует свой ДНС (CoreDNS) 

- Установка BIND9
```bash
apt update
apt install -y bind9 bind9utils bind9-doc
```

- vi /etc/bind/named.conf.options
```bash
//
// ------------------------------------------------------------
//  Глобальные параметры BIND 9
// ------------------------------------------------------------
options {
    // Где BIND хранит кэш и служебные файлы
    directory "/var/cache/bind";

    // Разрешаем рекурсивные запросы 
    recursion yes;

    // Кому разрешена рекурсия. В лаборатории можно any,
    // в проде указать свою подсеть.
    allow-recursion { any; };

    // На каких интерфейсах слушать DNS-запросы
    listen-on  { 192.168.122.66; 127.0.0.1; };
    listen-on-v6 { none; };          // IPv6 не используем

    // Куда пересылать внешние запросы
    forwarders { 8.8.8.8; 1.1.1.1; };

    // Включаем автоматическую проверку DNSSEC-подписей
    dnssec-validation auto;
};
```

- vi /etc/bind/named.conf.local
```bash
// ------------------------------------------------------------
//  Авторитетные зоны
// ------------------------------------------------------------

// Прямая зона lab.local  (имя → IP)
zone "lab.local" IN {
    type master;                       // главный (= авторитет)
    file "/etc/bind/zones/db.lab.local";
    allow-update { none; };            // динамических правок не ждём
};

// Обратная зона 122.168.192.in-addr.arpa  (IP → имя)
zone "122.168.192.in-addr.arpa" IN {
    type master;
    file "/etc/bind/zones/db.192.168.122";
    allow-update { none; };
};
```

- mkdir -p /etc/bind/zones

- vi /etc/bind/zones/db.lab.local
```bash
$TTL 86400          ; время жизни записей по умолчанию (24 ч)

@   IN  SOA k8s-infra.lab.local. admin.lab.local. (
        2025062401 ; Serial  (YYYYMMDDnn) — увеличивайте при каждой правке
        1h         ; Refresh  — как часто slave (если бы был) проверяет SOA
        15m        ; Retry    — если refresh не удался
        7d         ; Expire   ; после этого зона считается устаревшей
        1h )       ; Negative TTL — кэш «NXDOMAIN»

        ; — NS-запись: кто авторитетен для зоны
        IN  NS  k8s-infra.lab.local.

; ---------- A-записи ----------
k8s-master   IN  A   192.168.122.157 ; control-plane
k8s-worker1  IN  A   192.168.122.141 ; worker-1
k8s-worker2  IN  A   192.168.122.192 ; worker-2
k8s-infra    IN  A   192.168.122.66  ; infra + DNS
```

- vi /etc/bind/zones/db.192.168.122
```bash
$TTL 3600
@   IN  SOA k8s-infra.lab.local. admin.lab.local. (
        2025062401
        1h
        15m
        7d
        1h )

        IN  NS  k8s-infra.lab.local.

; ---------- PTR-записи (последний октет → FQDN) ----------
157  IN  PTR k8s-master.lab.local.
141  IN  PTR k8s-worker1.lab.local.
192  IN  PTR k8s-worker2.lab.local.
66   IN  PTR k8s-infra.lab.local.
```


- Проверка синтаксиса
```bash
# Проверяем синтаксис конфигурации
named-checkconf

# Проверяем каждую зону
named-checkzone lab.local /etc/bind/zones/db.lab.local
named-checkzone 122.168.192.in-addr.arpa /etc/bind/zones/db.192.168.122
```

- Перезапуск сервиса
```bash
systemctl restart named
systemctl enable named
```

- Добавить на каждой ноде в конфиг netplan
```yml
nameservers:
  search: [lab.local]
  addresses: [192.168.122.66, 8.8.8.8]
```

- Применить 
```bash
netplan apply
# или, если нужен лог
sudo netplan apply --debug
```

- Проверка работы DNS
```bash
dig +short k8s-worker2.lab.local
# prt-запись
dig -x 192.168.122.192 +short
```

#### Настройка NFS

##### Настройка NFS-сервера

- Устанавливаем сервер
```bash
apt update
apt install -y nfs-kernel-server
```

- Создаём каталог который будет экспортироваться
```bash
mkdir -p /srv/nfs/k8s
# пользователь без привилегий
chown nobody:nogroup /srv/nfs/k8s
chmod 0770 /srv/nfs/k8s
```

- `vi /etc/exports`
```
/srv/nfs/k8s 192.168.122.0/24(rw,sync,no_subtree_check,root_squash,fsid=0)
```

- `rw` - разрешает чтение и запись
- `sync` - операции записи выполняются немедленно (безопасно)
- `no_subtree_check` - ускоряет работу при экспорте подкаталогов
- `root_squash` - если клиент заходит как root, он будет понижен до "nobody" (безопаснее)
- `fsid=0`- нужен для корня экспортов в NFSv4 (в NFSv4 экспортируется только один корень)
- `192.168.122.0/8` - сеть, которой разрешён доступ
    
- Экспортировать каталог
```bash
exportfs -rav
# проверить
exportfs -v
```

##### Настройка NFS-клиента

```bash
apt install -y nfs-common
```

- Проверить доступность сервера
```bash
# показывает доступные каталоги
showmount -e 192.168.122.157
```

- Монтируем расшаренный каталог на клиент
```bash
mount -t nfs4 192.168.122.157:/ /mnt
```

- Добавить в `/etc/fstab`, для автомонтирования при перезагрузке
```bash
echo "192.168.122.157:/srv/nfs/k8s /mnt nfs4 defaults,_netdev 0 0" | tee -a /etc/fstab
```

#### Разворачиваем кластер

- Версии api, которые поддерживает установленная версия `kubeadm`
```bash
kubeadm config print init-defaults | grep apiVersion
```

- `vi /etc/kubernetes/kubeadm-config.yaml`
```bash
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
bootstrapTokens:
- groups:
  - system:bootstrappers:kubeadm:default-node-token
  ttl: 24h0m0s
  usages:
  - signing
  - authentication
localAPIEndpoint:
  advertiseAddress: 192.168.122.157
  bindPort: 6443
nodeRegistration:
  criSocket: "unix:///var/run/containerd/containerd.sock"
  imagePullPolicy: IfNotPresent
  name: k8s-master.lab.local
  taints:
  - effect: NoSchedule
    key: node-role.kubernetes.io/master
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
certificatesDir: /etc/kubernetes/pki
clusterName: cluster.local
controllerManager: {}
dns: {}
etcd:
  local:
    dataDir: /var/lib/etcd
imageRepository: "registry.k8s.io"
apiServer:
  timeoutForControlPlane: 4m0s
  extraArgs:
    authorization-mode: Node,RBAC
    bind-address: 0.0.0.0
    service-cluster-ip-range: "10.233.0.0/18"
    service-node-port-range: 30000-32767
kubernetesVersion: "1.30.14"
controlPlaneEndpoint: 192.168.122.157:6443
networking:
  dnsDomain: cluster.local
  podSubnet: "10.233.64.0/18"
  serviceSubnet: "10.233.0.0/18"
scheduler: {}
---
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
bindAddress: 0.0.0.0
clusterCIDR: "10.233.64.0/18"
ipvs:
  strictARP: True
mode: ipvs
---
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
clusterDNS:
- 169.254.25.10
systemReserved:
  memory: 512Mi
  cpu: 500m
  ephemeral-storage: 2Gi
# Default: "10Mi"
containerLogMaxSize: 10Mi
# Default: 5
containerLogMaxFiles: 3
```

- Инициализация первой ноды
```bash
kubeadm init --config /etc/kubernetes/kubeadm-config.yaml
```

- Если приложение долго не завершает свою работу, значит что-то пошло не так. Необходимо отменить все действия и запустить его ещё раз, но с большим уровнем отладки.
```bash
kubeadm reset
kubeadm init --config /etc/kubernetes/kubeadm-config.yaml -v5
```

- Смотрим ip для доступа к кластеру
```bash
kubectl cluster-info
```

- Установим драйвер сети (CNI Plugin), Cilium CNI с поддержкой multicast для разворота нод ROS2
```bash
CLI_VER=0.16.7
curl -L --remote-name-all \
  https://github.com/cilium/cilium-cli/releases/download/v${CLI_VER}/cilium-linux-amd64.tar.gz
tar xzvf cilium-linux-amd64.tar.gz
sudo mv cilium /usr/local/bin/
cilium version    

cilium install \
  --version 1.17.5 \
  --set ipam.mode=kubernetes \
  --set tunnel=vxlan \
  --set enable-multicast=true

# ждём OK
cilium status --wait   
```

- Смотрим ноды в кластере
```bash
kubectl get nodes
```
- Смотрим поды на ноде
```bash
kubectl get pods -A
```

- Регистрируем воркер ноды в кластере (представленная команда выводится в стандартный вывод после инициализации первой контрол ноды)
```bash
kubeadm join 192.168.122.157:6443 --token xp77tx.kil97vo6tlfdqqr4 \
	--discovery-token-ca-cert-hash sha256:2bec2613d6f016eee60d9e7af7bf98ef44753cbd26f11cce8d71df694bcebddf 
```

### Общее

- `kubectl explain <name>` - дока (`kubectl explain pod.spec`)
- `kubectl edit deployment deployment_name` (kubectl edit) - изменение манифеста на лету, нигде не версионируется (использовать только для дебага на тесте)

### POD

k8s - кластерная ОС

POD - одно запущенное приложение в кластере k8s, минимальная абстракция k8s (внутри пода может быть несколько контейнеров, и в поде всегда минимум 2 контейнера: приложение, сетевой неймспейс) (контейнер внутри пода, как отдельный процесс в ОС)

- `kubectl create -f pod.yml` - создать под согласно конфигу из файла
- `kubectl get pod` - список подов 
- `kubectl describe pod <pod_name>` - описание пода
- `kubectl describe pod <pod_name> -n <namespace> | less` - описание пода в нс
- `kebectl delete pod <pod_name>` или `kubectl delete -f pod.yml` - удаление пода
- `k -n <ns_name> delete pod <pod_name>` - удалить под

- `k get pod <pod_name> -n <ns_name> -o yaml | less` - посмотреть полный манифест пода
- `kubectl -n <ns_name> logs <pod_name>` - логи пода
- `kubectl -n <ns_name> logs <pod_name> -c <container_name>` - логи последнего контейнера

!!! info "Разница между `create` и `apply`"
    `create` создаёт ресурс только если его ещё нет, если ресурс уже существует — выдаёт ошибку

    `apply` cоздаёт ресурс, если его нет,или обновляет, если он уже существует, поддерживает историю изменений, идемпотентен

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

#### Ресурсы (QoS)

Приоритет Pod'ов при выделении ресурсов и при давлении на узел

QoS не управляется напрямую, а автоматически присваивается каждому Pod'у в зависимости от указанных ресурсов (requests и limits) в манифесте.

куб определяет 3 уровня QoS

- `Guaranteed` - requests == limits для всех контейнеров в Pod'е, высший приоритет, удаляется в последнюю очередь
- `Burstable` - задан requests, но не равно limits, или не для всех
- `BestEffort` - не указано ничего (ни requests, ни limits), если ресурсов на ноде не хватает, такие поды убиваются в первую очередь

- Посмотреть QoS пода
```bash
kubectl get pod <pod-name> -o jsonpath='{.status.qosClass}'
```

#### Best practice для описания пода 

Должны быть:

- Метки
- Задан образ контейнера
- Ресурсы контейнера(ов) ограничены
- Пробы

### Namespace 

- Namespace используются для изоляции групп ресурсов в пределах одного кластера kubernetes. Имена ресурсов должны быть уникальными в пределах namespace.

- `kubectl get ns` - вывести неймспейсы
- `kubectl create ns <name>` - создать нс 
- `kubectl delete ns <name>` - удалить нс
- `k get ns <name>`
- `kubectl config set-context --current --namespace=<имя-namespace>` - сменить ns чтобы писать команды без флага `-n`

- нс `kube-system` располагаются приложения control-plane 
- нс `kube-public` доступен для чтения всем клиентам

### Repcicaset

- `kubectl get rs` - вывести репликасеты
- `kubectl delete rs <name>-rs` - удалить rs
- `k delete replicaset --all` - удалить все rs в ns
- `k describe replicaset <name>`
- `k scale --replicas 3 replicaset <name>` - заскейлисть репликасет 
- `k set image replicaset <name> <container_name>=<new_image_name>` - обновить образ контейнера (но нужно пересоздать поды, replicaset не решает проблему обновления приложения, rs просто поддерживает заданное количество подов, задачу обновления решает абстрацкия deployment)

- Пример конфигурации 
```yaml 
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: myapp-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp-container
          image: nginx
```

### Deployment

Абстракция более выского уровня, которая управляте replicasetами и podами

- создаёт и управляет ReplicaSet'ом
- Rolling updates — обновляет приложения без простоя
- Откат (rollback) к предыдущей версии
- Масштабирование (scale up/down)
- Самовосстановление (если Pod удалён или упал)

- Пример `deployment`
```yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: myapp-container
        image: nginx:1.25
        ports:
        - containerPort: 80
```

#### Обновление 

- создаваёт новый ReplicaSet с новой версией образа
- постепенно увеличивает количество новых Pod'ов и уменьшает старые
- следит, чтобы всегда было достаточно доступных реплик

- Пример обновления образа
```bash 
kubectl set image deployment/myapp myapp-container=nginx:1.26
```

- Откат на предыдущую версию deployment (на ту версию, которая была применена до последнего успешного обновления)
```bash 
kubectl rollout undo deployment myapp
```

- Проверка состояния
```bash
kubectl rollout status deployment myapp
kubectl get deployment
kubectl describe deployment myapp
```

- При каждом изменении (kubectl apply, set image, scale, и т.п.) создаётся новая ревизия, по умолчанию куб хранит 10 ревизий
```bash
# посмотреть историю ревизий
kubectl rollout history deployment myapp
# откатиться к ревизии
kubectl rollout undo deployment myapp --to-revision=3
```

