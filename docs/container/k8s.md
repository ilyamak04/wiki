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

- `apt update && apt install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst` - устанавливаем гипервизор
- Загружаем образ Ununtu
```bash
# загружаем live-образ убунты
wget https://releases.ubuntu.com/24.04/ubuntu-24.04.3-live-server-amd64.iso \
     -O /var/lib/libvirt/images/ubuntu-24.04.3-live-server-amd64.iso

# проверяем что загрузили
ls -lh /var/lib/libvirt/images/
```
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
    - `virsh undefine <vm_name> --remove-all-storage` - удалить вм со всеми дисками
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
echo "192.168.122.157:/ /mnt nfs4 defaults,_netdev 0 0" | tee -a /etc/fstab
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
- `kubectl config get-contexts` - информация о текущем контексте

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

#### Пробы

- Если проба УСПЕШНА:
    - `Readiness Probe` - Под добавляется в эндпоинты Service. Теперь трафик с Load Balancer'а будет направляться на этот под
    - `Liveness Probe` - Ничего не происходит. Контейнер продолжает работать как обычно 
- Если проба НЕУДАЧНА:
    - `Readiness Probe` - Под удаляется из эндпоинтов Service. Трафик на этот под прекращается. Контейнер НЕ перезапускается
    - `Liveness Probe` - Контейнер убивается и перезапускается (согласно политике restartPolicy).

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

- `kubectl config get-contexts` - узнать в каком нс находишься

### Repcicaset

Задача Replicaset - обеспечить работу заданного количества реплик Pod'ов, описываемых Deployment

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

Абстракция, которая управляте replicasetами и podами

Deployment предназначен для stateless приложений

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

- `spec.selector` - определяет за какие поды отвечает Deployment

- `kubectl rollout restart` - перезапуск Deployment 

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

### Service 

Сущность, которая предоставляет постоянную сетевую точку доступа к группе Pod'ов

- `kubectl get endpoints my-service` - оказывает IP-адреса Pod'ов, к которым направляет трафик Service my-service
- `k get EndpointSlice`

#### Service headless 

Не обеспечивает балансировку трафика к подам (нет ClusterIP), позволяет обращаться к поду по его доменному имени, используется с Statefulset, т.к. поды "статичны"

### Statefulset

Крнтроллер, похожий на Deployment гарантирует уникальность имени пода, порядок запуска, рестарта, удаления пода, постоянство ip-адреса, томов

### Тома

#### emptyDir

Обычно используется для:

- размещения кэша файлов 
- данные которые необходимо хранить при сбоях в работе контейнера
- обмена файлами между несколькими контейнерами в поде

!!! info "При удалении пода (например, при перезапуске, обновлении, сбое узла и т.д.) — данные из emptyDir удаляются безвозвратно"

- Кусочек конфига
```yaml
  volumeMounts:
      - name: empty-volume
        mountPath: /empty
volumes:
- name: empty-volume
    emptyDir: {}
```

#### hostPath

!!! warning "Изпользовать hostPath небезопасно!!!"
    Контейнер получает прямой доступ к файловой системе хоста

- Пример
```yaml
volumes:
  - name: host-logs
    hostPath:
      path: /var/log/nginx
      type: Directory
```

- Kubernetes может проверять, существует ли путь, и что он из себя представляет
```yaml
type: Directory          # Должен быть каталог
type: DirectoryOrCreate  # Создает каталог, если его нет
type: File               # Должен быть файл
type: FileOrCreate       # Создает файл, если его нет
type: Socket             # Должен быть сокет
type: CharDevice         # Символьное устройство
type: BlockDevice        # Блочное устройство
```

#### ConfigMap

ConfigMap - сущность, предназначенная для хранения нечувствительных данных конфигурации в виде пар ключ: значение, позволяет отделить конфигурацию от кода и применять её к контейнерам без необходимости пересборки образа.

- `k get cm`

- Пример 
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: example-pod
spec:
  containers:
  - name: app
    image: myapp:latest
    envFrom:
    - configMapRef:
        name: my-config
```

---


- Пример
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  APP_MODE: production
  LOG_LEVEL: debug
```


- Передача переменных окружения из ConfigMap в Pod
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: configmap-demo
spec:
  containers:
  - name: app
    image: busybox
    command: ["sh", "-c", "env"]
    env:
    - name: APP_MODE
      valueFrom:
        configMapKeyRef:
          name: my-config
          key: APP_MODE
    - name: LOG_LEVEL
      valueFrom:
        configMapKeyRef:
          name: my-config
          key: LOG_LEVEL
```


- Если переменная уже определена через env, она не будет перезаписана envFrom.
- Можно использовать сразу несколько envFrom (например, ConfigMap и Secret).
- Если переменная в ConfigMap содержит недопустимые символы (например, точки или тире), она не будет импортирована как env.

#### Secret

Секрет - это объект, который содержит небольшое количетсво конфиденциальных даннх

- `k get secret`
- `k get secret <name> -o yaml`

- Типы секрета
    - `generic` (Opaque) - пароли/токены для приложений
    - `docker-registry` - данные авторизации в docker registry
    - `tls` - TLS сертификаты

- Пример
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
data:
  username: YWRtaW4=     # base64 от 'admin'
  password: MWYyZDFlMmU2N2Rm   # base64 от '1f2d1e2e67df'
```

- Для удобства админитратора есть поле `strigData`, когда манифест примениться содержимое будет закодировано в base64
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
stringData:
  username: admin
  password: s3cr3t
```

- Так подключается в манифест
```yaml
    env:
    - name: username
      valueFrom:
        secretKeyRef:
          name: my-secret
          key: username
```

!!! warning ""
    При добавлении новых секретов, необходимо помнить про правила мерджа манифестов, аннотацию `kubectl.kubernetes.io/last-applied-configuration`

- Добавление секретов в контейнер в виде тома
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secret-volume-pod
spec:
  containers:
  - name: app
    image: alpine
    command: ["/bin/sh", "-c", "cat /etc/secret/* && sleep 3600"]
    volumeMounts:
    - name: secret-volume
      mountPath: /etc/secret
      readOnly: true
  volumes:
  - name: secret-volume
    secret:
      secretName: my-secret
```
```bash
# внутри контейнера
cat /etc/secret/username     # выведет: user
cat /etc/secret/password     # выведет: password
```

#### downwardAPI

`downwardAPI` позволяет передать метаданные `Pod'а`(например, имя пода, namespace, labels, annotations, ресурсы) в контейнер через переменные окружения или файлы.

- Пример (как том (файлы))
```yaml
          volumeMounts:
            - mountPath: "/etc/pod-info"
              name: pod-info
              readOnly: true
      volumes:
        - name: pod-info
          downwardAPI:
            items:
              - path: limit-cpu-millicores
                resourceFieldRef:
                  containerName: openresty
                  resource: limits.cpu
                  divisor: 1m
              - path: limit-memory-kibibytes
                resourceFieldRef:
                  containerName: openresty
                  resource: limits.memory
                  divisor: 1Ki
              - path: labels
                fieldRef:
                  fieldPath: metadata.labels
```

- Пример (как переменные окружения)
```yaml
env:
- name: MY_POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name

- name: MY_CPU_LIMIT
  valueFrom:
    resourceFieldRef:
      resource: limits.cpu
```

#### projected

`projected` - это том, который объединяет несколько источников данных в одну директорию

- `secret`
- `configMap`
- `downwardAPI`
- `serviceAccountToken`

- Пример 
```yaml
          volumeMounts:
            - mountPath: "/etc/pod-data"
              name: all-values
              readOnly: true
      volumes:
        - name: all-values
          projected:
            sources:
              - downwardAPI:
                  items:
                    - path: limits/cpu-millicore
                      resourceFieldRef:
                        containerName: openresty
                        resource: limits.cpu
                        divisor: 1m
                    - path: limits/memory-kibibytes
                      resourceFieldRef:
                        containerName: openresty
                        resource: limits.memory
                        divisor: 1Ki
                    - path: labels
                      fieldRef:
                        fieldPath: metadata.labels
              - secret:
                  name: user-password-secret
                  items:
                    - key: user
                      path: secret/user
                    - key: password
                      path: secret/password
              - configMap:
                  name: example-txt
                  items:
                    - key: example.txt
                      path: configs/example.txt
                    - key: config.yaml
                      path: configs/config.yaml
```



### PV, PVC

- `k get pv`

PersistentVolume (PV) - это объект, который предоставляет долговременное хранилище для Pod'ов, независимое от их жизненного цикла, под подключается к хранилищу не напрямую, а через PersistentVolumeClaim (PVC)    

!!! info "PVC работает только внутри одного namespace, а PV - кластерный объект"

- Архитектура
    - PersistentVolume (PV) - описывает конкретный ресурс хранилища (например, NFS, iSCSI, Ceph, диск в облаке, локальный диск)
    - PersistentVolumeClaim (PVC) - это запрос от Pod-а: «Хочу хранилище с такими-то параметрами»
    - Kubernetes связывает PVC с подходящим PV (если типы и параметры совместимы)

- `accessModes` (способы доступа)
    - `ReadWriteOnce` (RWO) - том может быть смонтирован на чтение и запись только одним узлом
    - `ReadOnlyMany` (ROX) - том может быть смонтирован на чтение многими узлами
    - `ReadWriteMany` (RWX) - том может быть смонтирован на чтение и запись многими узлами. Требуется поддержка со стороны бэкенда (например, NFS, CephFS)
    - `ReadWriteOncePod` (RWOP) - том может быть смонтирован на чтение и запись только одним подом, гарантирует, что только один под во всем кластере имеет доступ к тому

- `persistentVolumeReclaimPolicy` — что делать после удаления PVC
    - `Retain` - PV остаётся, данные сохраняются (нужно вручную очистить/перепривязать) поведение ПО УМОЛЧАНИЮ для статически созданных томов
    - `Delete` - PV и данные удаляются автоматически
    - `Recycle` - устаревший способ (удаляет файлы, оставляет PV)

- (Связывание PVC c PV) Куб находит подходящий PV по: 
    - `storage` (размер — должен быть ≥ запроса)
    - `accessModes` (PV должен удовлетворять запрошенному)
    - `StorageClass` (если указан)

!!! info "Если нет подходящего PV - PVC останется в состоянии Pending"

#### Dynamic Provisioning

Настраивается один раз специальный компонент - Provisioner, далее Kubernetes автоматически создает новые PV по запросу от PVC

Как это +- работает:

- Администратор создает `StorageClass`, который описывает тип хранилища и то, как его следует создавать (какой provisioner использовать)
- Разработчик в своем `PVC` указывает, "мне нужно хранилище из такого-то StorageClass"
- `PVC` попадает в Kubernetes (etcd)
- `Provisioner` (контроллер, следящий за неудовлетворенными PVC) видит это
- `Provisioner` автоматически создает новый PV того типа и размера, который был запрошен
- `Provisioner` связывает этот новый PV с PVC
- Том монтируется поду

`Provisioner` - специальный контроллер, который и реализует функционал динамического создания томов

Примеры `Provisioner'ов`

- `pd.csi.storage.gke.io` - для создания дисков в Google Cloud (GKE)
- `ebs.csi.aws.com` - для создания дисков EBS в AWS
- `disk.csi.azure.com` - для Azure Disks
- `nfs.csi.k8s.io` - для динамического создания NFS-шар
- `rancher.io/local-path` - для создания томов на локальных дисках нод

Как пример работает

- Проверяет API Kubernetes на предмет появления новых `PVC`
- Видит `PVC`, который ссылается на `StorageClass` с его именем (provisioner: pd.csi.storage.gke.io)
- Вызывает API своего облачного провайдера (Google Cloud, AWS) для создания реального диска
- Создает в Kubernetes объект `PersistentVolume`, который указывает на этот только что созданный диск
- Связывает `PV` и `PVC`

- Пример `SrorageClass`
```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd # Название класса, на которое ссылается PVC
provisioner: pd.csi.storage.gke.io # Драйвер, который умеет создавать диски
parameters:
  type: pd-ssd # Тип диска в облаке (SSD)
  replication-type: regional-pd # Реплицируемый диск
reclaimPolicy: Delete # Что делать с томом при удалении PVC? (Delete или Retain)
volumeBindingMode: WaitForFirstConsumer # Ждать создания тома до назначения на под
allowVolumeExpansion: true # Можно ли потом увеличить размер тома
```

- Пример `PVC`, который использует `SrorageClass`
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-database-pvc
  namespace: my-app
spec:
  accessModes:
    - ReadWriteOnce # Том может быть смонтирован на чтение и запись только одним узлом
  storageClassName: fast-ssd # Запрашиваем хранилище из этого класса
  resources:
    requests:
      storage: 100Gi # Запрашиваем 100 Гибибайт
```

- Пример `Pod`, который используетс `PVC`
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-database-pod
spec:
  containers:
  - name: db
    image: postgres:16
    volumeMounts:
    - name: data-storage # Монтируем в Pod
      mountPath: /var/lib/postgresql/data
  volumes:
  - name: data-storage
    persistentVolumeClaim:
      claimName: my-database-pvc # Указываем имя PVC, который хотим использовать
```

- `reclaimPolicy`
    - `Delete` - при удалении `PVC` автоматически удаляется и связанный с ним `PersistentVolume`, а также физический диск в облаке, данные будут безвозвратно утеряны, это поведение ПО УМОЛЧАНИЮ для ДИНАМИЧЕСКИ созданных томов
    - `Retain` - при удалении `PVC` сам `PV` переходит в состояние `Released`, данные на диске остаются, но том нельзя заново использовать, пока администратор вручную не очистит и не восстановит его, это безопасная политика

- `Access Modes` - 


### DaemonSet

Для запуска пода на каждой ноде кластера, если нет ограничений (Taints и Tolerations)
Манифест как у `Deployment`, кроме параметра `kind`, нет параметра `resplicas`

- `k get ds`

### Taint 

Taint - это свойство ноды, которое действует как ограничение. Взаимодействует с планировщиком.

taint состоит из трёх частей: `key=[value]:Effect`

- `key` - ключ taint (например, node-role.kubernetes.io/control-plane)
- `value` - значение taint. Не обязателен к определению. Если не указано, то любое значение будет считаться совпадением.
- `Effect` - действие.
  - `NoSchedule` - запрещает планирование под на ноде. Поды, запущенные до применения taint не удаляются.
  - `NoExecute` - запрещает планирование под на ноде. Поды, запущенные до применения taint будут удалены с ноды.
  - `PreferNoSchedule` - это «предпочтительная» или «мягкая» версия NoSchedule. Планировщик будет пытаться не размещать на узле поды, но это не гарантировано.
  
Что бы игнорировать taint `node-role.kubernetes.io/control-plane:NoSchedule` для подов DaemonSet необходимо добавить в манифест толерантность к конкретному типу taint в спецификации пода, например:

```yaml
spec:
  tolerations:
    - key: "node-role.kubernetes.io/control-plane"
      operator: "Exists"
      effect: "NoSchedule"
```

Если мы не указываем значение ключа (value), `operator` должен быть установлен в `Exists`.

- `kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints` - посмотреть taint'ы на нодах
- Добавить taint
```bash
kubectl taint nodes <node_name> key=[value]:Effect
kubectl taint nodes wr2.kryukov.local test-taint=:NoExecute
```
- Чтобы снять taint, добавить в конце команды `-`
```bash
kubectl taint nodes wr2.kryukov.local test-taint=:NoExecute-
```

### NodeSelector

Если необходимо разместить поды на строго определённых нодах кластера, в этом случае можно использовать `nodeselector`. В качестве параметра, используемого для отбора нод, можно указать метки (labels), установленные на нодах.

- `kubectl get nodes --show-labels` - метки на  нодах
- `kubectl label nodes <node_name> test=test` - добавить метку на ноду
- `kubectl label nodes <node_name> test=test-` - снять метку с ноды

```yaml
spec:   
    nodeSelector:
        special: ds-only
```

### Toleration

Toleration не гарантирует, что под будет размещен на помеченном узле. Он лишь разрешает это. Решение все равно принимает планировщик на основе других факторов (достаточно ли ресурсов и т.д.).

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  containers:
  - name: my-app
    image: nvidia/cuda:11.0-base
    resources:
      limits:
        nvidia.com/gpu: 1
  # Ключевая секция:
  tolerations:
  - key: "gpu"           # Должен совпадать с key taint'а
    operator: "Equal"    # Оператор сравнения. "Equal" или "Exists"
    value: "true"        # Должен совпадать с value taint'а (если operator=Equal)
    effect: "NoSchedule" # Должен совпадать с effect taint'а
```

```yaml 
operator: "Equal" # точное совпадение по value 
operator: "Exists" # Toleration сработает для любого taint'а с указанными key и effect. Значение value в этом случае указывать не нужно
```

### Job

Deployment, например, предназначен для запуска долгоживущих процессов (веб-сервер), которые должны работать постоянно (running), их цель быть всегда доступными

`Job` предназначен для запуска одноразовых задач, которые должны выполниться и завершиться успешно (Succeeded), их цель - выполнить работу и прекратить существование

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: example-job
spec:
  # Шаблон пода, который будет выполнять работу
  template:
    spec:
      containers:
      - name: worker
        image: busybox
        command: ["echo", "Hello, Kubernetes Job!"]
      restartPolicy: Never # или OnFailure. Для Job НЕ допускается Always.

  # Количество успешных завершений, необходимое для успеха всей Job
  completions: 1 # (по умолчанию 1)

  # Количество Pod'ов, которые могут работать параллельно для достижения цели
  parallelism: 1 # (по умолчанию 1)

  # Политика перезапуска подов при failure
  backoffLimit: 6 # (по умолчанию 6) Макс. количество попыток перезапуска пода

  # Таймаут для Job в секундах. Если Job выполняется дольше - она будет убита.
  activeDeadlineSeconds: 3600
```

**Как работает Job?**

- Вы создаете объект Job (например, через kubectl apply -f job.yaml).
- Job-контроллер видит новую задачу и создает один или несколько Pod'ов на основе template.
- Контроллер следит за состоянием Pod'ов.
    - Успех: Если под завершается с кодом выхода 0, это считается успешным завершением (Succeeded).   
    - Неудача: Если под завершается с ненулевым кодом выхода, он считается неудачным (Failed).

- Логика перезапуска:
    - Если restartPolicy: OnFailure, kubelet перезапустит контейнер внутри того же пода.
    - Если restartPolicy: Never, Job-контроллер создаст новый под.

- Job продолжает создавать новые поды (с экспоненциальной задержкой, чтобы не заспамить кластер), пока не будет достигнуто либо:
- Успешное завершение количества подов, указанного в completions.
- Превышено количество попыток backoffLimit — тогда вся Job помечается как Failed.


- `kubectl apply -f job.yaml` - создать job из файла
- `kubectl get jobs` - список джобов
- `kubectl describe job <job-name>` - свойства джоба
- `kubectl logs <pod-name>` - логи конкретного пода
- `kubectl delete job <job-name>` - удалить Job (автоматически удалит и все его Pod'ы)

- Пример манифеста Job
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi-calculation
spec:
  backoffLimit: 4
  template:
    spec:
      containers:
      - name: pi
        image: perl:5.34
        command: ["perl",  "-Mbignum=bpi", "-wle", "print bpi(2000)"] 
      restartPolicy: Never
```

### CronJob

CronJob — это контроллер, который управляет Job'ами, он создает объекты Job по расписанию, используя синтаксис cron

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: example-cronjob
spec:
  # Самое главное: расписание в формате cron
  schedule: "*/5 * * * *" 

  # Шаблон для создания Job
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: hello
            image: busybox
            command: ["echo", "Hello from CronJob!"]
          restartPolicy: OnFailure

  # Сколько последних успешных Job хранить в истории
  successfulJobsHistoryLimit: 3 # (по умолчанию 3)

  # Сколько последних неудачных Job хранить в истории
  failedJobsHistoryLimit: 1 # (по умолчанию 1)

  # Что делать, если новый запуск по расписанию наступает, а предыдущая Job все еще работает
  concurrencyPolicy: Allow # Разрешить параллельные запуски. Другие значения: "Forbid" (запретить), "Replace" (заменить текущую).
  
  # Приостановить работу CronJob (не создавать новые Job), не удаляя уже работающие Job
  suspend: false # по умолчанию
```

- `kubectl apply -f cronjob.yaml` - создать/обновить CronJob
- `kubectl get cronjobs` - посмотреть CronJob
- `kubectl get cj` - посмотреть CronJob
- `kubectl get jobs` - посмотреть Job, созданные CronJob
- `kubectl patch cronjob <cronjob-name> -p '{"spec":{"suspend":true}}'` - приостановить CronJob
- `kubectl patch cronjob <cronjob-name> -p '{"spec":{"suspend":false}}'` - возобновить CronJob
- `kubectl delete cronjob <cronjob-name>` - удалить CronJob (удаляет сам CronJob, но НЕ удаляет созданные им Job)
- `kubectl create job --from=cronjob/<cronjob-name> <manual-job-name>` - принудительно запустить CronJob немедленно, не дожидаясь расписания

- Пример манифеста CronJob
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 2 * * *" # Каждый день в 2:00 ночи
  successfulJobsHistoryLimit: 2
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: report-generator
            image: python:3.9
            command: ["python", "/app/generate_daily_report.py"]
          restartPolicy: OnFailure
```

### Affinity

Основные вижы Affinity

- `Node Affinity` - привязка пода к определенным характеристикам ноды
- `Inter-Pod Affinity/Anti-Affinity` - привязка пода к другим подам или отталкивание от них

#### Node Affinity

- `requiredDuringSchedulingIgnoredDuringExecution` - Жесткое правило ("Должен"). Под обязательно будет размещен на узле, удовлетворяющем условию. Если подходящего узла нет, под останется в статусе Pending
- `preferredDuringSchedulingIgnoredDuringExecution` - Предпочтение ("Желательно"). Планировщик попытается найти узел, удовлетворяющий условию. Если не найдет - разместит под на любом другом подходящем узле

> Часть `IgnoredDuringExecution` означает, что если метки на узле изменятся после того, как под уже был размещен, это не приведет к выселению пода

Операторы (operator) в `matchExpressions`:
- `In` - значение метки узла находится в указанном списке
- `NotIn` - значение метки узла НЕ находится в указанном списке
- `Exists`- узел имеет метку с указанным ключом (значение не важно)
- `DoesNotExist` - у узла НЕТ метки с указанным ключом
- `Gt (Greater than)`,` Lt (Less than)` - для числовых значений

- Пример манифеста
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app-pod
spec:
  containers:
  - name: my-app
    image: my-app:latest
  affinity:
    nodeAffinity:
      # ЖЕСТКОЕ правило: под должен быть размещен на узле с меткой 'disktype=ssd'
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: disktype
            operator: In
            values:
            - ssd
      # ПРЕДПОЧТЕНИЕ: и желательно, чтобы это был быстрый NVMe SSD
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1 # Относительный вес (важность) среди других предпочтений (1-100)
        preference:
          matchExpressions:
          - key: ssd-type
            operator: In
            values:
            - nvme
```

#### Inter-Pod Affinity/Anti-Affinity 

Позволяет указывать правила размещения пода относительно других подов.

- `Pod Affinity` - "Размести этот под рядом/на том же узле, что и эти другие поды"
- `Pod Anti-Affinity` - "Размести этот под подальше/на другом узле, от этих других подов"

Ключевые понятия:

- `topologyKey` - указывает домен, в котором применяется правило, это метка узла. Может использоваться `kubernetes.io/hostname` (правило применяется в пределах одного узла) или `topology.kubernetes.io/zone` (правило применяется в пределах одной зоны доступности)

- ПРИМЕР. Разместить реплики одного приложения на разных узлах для повышения отказоустойчивости.
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-web-app
  template:
    metadata:
      labels:
        app: my-web-app # По этой метке будем искать другие поды
    spec:
      containers:
      - name: web
        image: nginx:latest
      affinity:
        podAntiAffinity:
          # ЖЕСТКОЕ правило: не размещать два пода с app=my-web-app на одном узле
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - my-web-app
            topologyKey: kubernetes.io/hostname # Где применять Affinity 
```

!!! tip "Affinity-правила могут быть сложными, полезно комментировать их в манифестах"

В итоге:

!!! info ""
    - `Taint` - это свойство ноды, которое действует как ограничение,сообщает планировщику кубера (kube-scheduler), что на этом узле запрещено пускать любые поды, которые не имеют `Toleration` к данной `Taint`
    - `Toleration` - это свойство пода, которое дает ему право быть запланированным на узле с определенным `Taint`, несмотря на ограничение
    - `Affinity` - это набор правил для пода, которые позволяют ему притягиваться к узлам или другим подам с определенными характеристиками 

#### Pod Topology Spread Constraints

Для равномерного распределения подов между зонами

```yaml
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: *name
              app.kubernetes.io/instance: *instance
              app.kubernetes.io/version: *version
          nodeAffinityPolicy: Ignore
          nodeTaintsPolicy: Honor
```

Параметры `topologySpreadConstraints`

- `maxSkew` - максимальная разница количества подов между доменами топологии
- `topologyKey` - метка на ноде кластера, которая используется для определения доменов топологии
- `whenUnsatisfiable` - что делать с подом, если он не соответствует ограничению
    - `DoNotSchedule` - (по умолчанию) запрещает планировщику запускать под на ноде
    - `ScheduleAnyway` - разрешает запускать под на ноде
- `labelSelector` - определяет список меток подов, попадающих под это правило
- `nodeAffinityPolicy` - определят будут ли учитываться `nodeAffinity`/`nodeSelector` пода при расчёте неравномерности распределения пода
    - `Honor` - (по умолчанию) в расчёт включаются только ноды, соответствующие `nodeAffinity`/`nodeSelector`
    - `Ignore` - в расчёты включены все ноды
- `nodeTaintsPolicy` - аналогично `nodeAffinityPolicy`, только учитываются `Taints`
    - `Honor` - Включаются ноды без установленных `Taints`, а так же ноды для которых у пода есть `Toleration`
    - `Ignore` - (по умолчанию) в расчёты включены все ноды.


### RBAC

`RBAC` - это механизм контроля доступа, который определяет:

- Кто (`Subject`) может выполнять
- Какие действия (`Verbs`) над
- Какими ресурсами (`Resources`) в Kubernetes.

- `Subject` - Тот, кто хочет выполнить действие:
    - `User` (Пользователь)
    - `Group` (Группа)
    - `ServiceAccount` (Сервисный аккаунт)

- `Resource` - Над чем выполняется действие:
    - `pods`, `services`, `deployments`, `secrets`, `nodes` и т.д.

- `Verb `- Что можно делать:
    - `get`, `list`, `create`, `update`, `delete`, `watch`, `patch`

--- 

- `ServiceAccount` (Сервисный аккаунт) - Для внутрикластерной аутентификации 
    - Существуют внутри Kubernetes
    - Привязаны к namespace
    - Имеют формат: system:serviceaccount:<namespace>:<name>
    - Автоматически создаются для каждого namespace (default)
    - Используются подами для взаимодействия с Kubernetes API

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: production
```

- `User` (Пользователь)  - Для внешней аутентификации
    - Не управляются Kubernetes
    - Создаются внешними системами (сертификаты, OIDC, LDAP)
    - Глобальные для всего кластера

!!! warn "User НЕ является объектом Kubernetes API!!!"

`Role` - определяет набор прав в рамках одного namespace
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: pod-reader
rules:
- apiGroups: [""] 
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
```


`ClusterRole` - определяет набор прав для всего кластера или для кластерных ресурсов
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch"]
```

`RoleBinding` - связывает `Role` с `Subject` в рамках `namespace`
```yaml 
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: User
  name: alice
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```


`ClusterRoleBinding` - связывает `ClusterRole` с `Subject` `для всего кластера`
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-nodes-global
subjects:
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-reader
  apiGroup: rbac.authorization.k8s.io
```

!!! tip "Как Pod использует ServiceAccount???"
  1. В Pod монтируется секрет с токеном ServiceAccount

  2. Путь: /var/run/secrets/kubernetes.io/serviceaccount

  3. Pod использует этот токен для аутентификации в Kubernetes API

  
!!! tip "При создании Pod без указания `serviceAccountName` используется `default` `ServiceAccount`"


Kubernetes имеет несколько полезных встроенных ClusterRoles:

- `view`: Просмотр большинства ресурсов (кроме Secrets, RBAC)
- `edit`: Просмотр + изменение (кроме RBAC)
- `admin`: Полный доступ в namespace (кроме resource quotas)
- `cluster-admin`: Полный доступ ко всему кластеру (супер-пользователь)
```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-admin
  namespace: development
subjects:
- kind: User
  name: developer1
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: admin
  apiGroup: rbac.authorization.k8s.io
```

- Полезные команды для проверки
```bash
# Проверить, может ли текущий пользователь создавать pods
kubectl auth can-i create pods

# Проверить для другого пользователя
kubectl auth can-i list secrets --as=system:serviceaccount:default:my-sa

# Проверить в конкретном namespace
kubectl auth can-i delete pods --namespace production

# Посмотреть все права для текущего пользователя
kubectl auth can-i --list

# Найти все ClusterRoleBinding
kubectl get clusterrolebindings -o wide

# Найти все RoleBinding в namespace
kubectl get rolebindings -n default
```


- Управление контекстами 
```bash
# Посмотреть все контексты
kubectl config get-contexts

# Переключиться на другой контекст
kubectl config use-context dev-context

# Посмотреть текущий контекст
kubectl config current-context

# Создать новый контекст
kubectl config set-context new-context \
  --cluster=my-cluster \
  --user=alice \
  --namespace=production
```

### ResourceQuota

ResourceQuota определяет ограничения на namespace

### Разное

Labels — структурированные данные для логики Kubernetes

- для селекторов (`matchLabels`, `labelSelector`)
- для группировки объектов (например, связать `Pod` с `ReplicaSet`, `Service`, `Deployment`)
- участвуют в логике работы контроллеров, планировщика (`scheduler`), сервисов и т.д.
- нужны для фильтрации: `kubectl get pods -l app=nginx`

Annotations — это метаданные, которые:

- Используются для хранения произвольной информации
- не участвуют в селекции
- используются вспомогательными компонентами:
    - Ingress-контроллеры
    - cert-manager
    - kubectl
    - Helm
    - CSI (storage drivers)
    - операторы
- аннотации часто используются для внутренней логики, дополнительных настроек, или даже инструкций для других систем, в том числе приложений внутри подов


--- 

- `kubectl describe node <node-name>` - инфо о ноде куба
- `kubectl get pods -o wide` - расширенный вывод о сущности
- `kubectl events` - события в кластере кубера


### Интересно 

- k8s - Eventually Consistent (Eventually consistent - система не гарантирует мгновенную согласованность, но гарантирует, что состояние со временем станет правильным), потому что куб постороен как набор независимых control loop (контроллеры)

- Как удаляются ресурсы в кубе 

Вот удалилы мы deployment, дальше приходит GC и видит что у rs нет owner, убивает rs, а потом и поды

- Kubernetes Events — это временные системные сообщения, создаваемые компонентами кластера, которые объясняют изменения состояния объектов и причины ошибок

## Helm

Helm - это пакетный менеджер, шаблонизатор для Kubernetes 

Template - абстракция над некоторым рекурсом K8s (Pod, Service, Ingress)

Chart - это пакет приложения

Просто папка с структурой 
```
myapp/
 ├── Chart.yaml
 ├── values.yaml
 ├── templates/
 │    ├── deployment.yaml
 │    ├── service.yaml
 │    └── ingress.yaml
 └── charts/
```

Release - это установленный chart в кластере.

Release = Chart + Values  

Helm - это не просто шаблонизатор, helm позволяет деплоить, он объединяет кучу манифестов в единую сущность релиза и позволяет ей управлять 

### Встроенные объекты

- `.Release` - Представляет информацию о текущем релизе

```bash
.Release.Name - Имя релиза (helm install myapp ./chart)
.Release.Namespace - Namespace, куда установлен релиз
.Release.Service - Сервис Helm (обычно Helm)
.Release.IsInstall - true, если это установка
.Release.IsUpgrade - true, если это апгрейд
.Release.Revision - Номер ревизии (для rollback)
.Release.Time - Время установки/обновления
```

- `.Chart` - Содержит информацию о самом чарт, который устанавливаешь

TODO: дописать про built-in object