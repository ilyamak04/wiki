
#### Как посмотреть SWAP ? 

- `Win+R`
- `sysdm.cpl`
- Дополнительно -> Быстродействие (параметры) -> Дополнительно -> Витульная память 


#### Как посмотреть блочные устройства RAM ? 

В powershell: 

- `Get-WmiObject Win32_PhysicalMemory | Format-Table Manufacturer, Capacity, Speed, PartNumber, DeviceLocator`   

- `Get-WmiObject Win32_PhysicalMemory | Select-Object Manufacturer, @{Name="Capacity(GB)";Expression={[math]::Round($_.Capacity / 1GB, 2)}}, Speed, PartNumber, DeviceLocator | Format-Table` - в Gb

#### Работа с переменными среды

- `Win+R`
- `sysdm.cpl`
- Дополнительно -> Переменные среды     

#### Как расширить диск

- `Win+R`
- `diskmgmt.msc`

`AOMEI Partition Assistant` - для работы с дисками

#### Реестр 

- `Win+R`
- `regedit` 

#### Панель управления

- `Win+R`
- `control`

#### Как подключиться по RDP

- `Win+R`
- `cmd`
- `mstsc /admin`
- ввести креды для подключения


#### Команды PowerShell

`Remove-Item -Path "C:\Users\Илья\Downloads\*" -Recurse -Force` - удалить файлы в каталоге

- Топ 30 больших файлов
```shell
Get-ChildItem -Path C:\ -Recurse -File -ErrorAction SilentlyContinue | 
Sort-Object Length -Descending | 
Select-Object -First 30 Name, @{Name="Size(GB)";Expression={[math]::Round($_.Length/1GB,2)}}, FullName
```