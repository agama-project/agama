import agama from "../agama";

agama.locale({
  "": {
    "plural-forms": (n) => n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2,
    "language": "ru"
  },
  " Timezone selection": [
    " Выбор часового пояса"
  ],
  " and ": [
    " и "
  ],
  "%1$s %2$s at %3$s (%4$s)": [
    "%1$s %2$s на %3$s (%4$s)"
  ],
  "%1$s %2$s partition (%3$s)": [
    "%1$s раздел %2$s (%3$s)"
  ],
  "%1$s %2$s volume (%3$s)": [
    "%1$s том %2$s (%3$s)"
  ],
  "%1$s root at %2$s (%3$s)": [
    "%1$s корень на %2$s (%3$s)"
  ],
  "%1$s root partition (%2$s)": [
    "Корневой раздел %1$s (%2$s)"
  ],
  "%1$s root volume (%2$s)": [
    "Корневой том %1$s (%2$s)"
  ],
  "%d partition will be shrunk": [
    "%d раздел будет сокращён",
    "%d раздела будут сокращены",
    "%d разделов будут сокращены"
  ],
  "%s disk": [
    "Диск %s"
  ],
  "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
    "%s - это неизменяемая система с атомарными обновлениями. Она использует файловую систему Btrfs, доступную только для чтения и обновляемую с помощью моментальных снимков."
  ],
  "%s logo": [
    ""
  ],
  "%s with %d partitions": [
    "%s с %d разделами"
  ],
  ", ": [
    ", "
  ],
  "A mount point is required": [
    "Требуется точка монтирования"
  ],
  "A new LVM Volume Group": [
    "новую группу томов LVM"
  ],
  "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
    "На выбранном диске будет выделена новая группа томов, а   файловая система будет создана как логический том."
  ],
  "A size value is required": [
    "Требуется значение размера"
  ],
  "Accept": [
    "Подтвердить"
  ],
  "Action": [
    "Действие"
  ],
  "Actions": [
    "Действия"
  ],
  "Actions for connection %s": [
    "Действия для соединения %s"
  ],
  "Actions to find space": [
    "Действия по поиску места"
  ],
  "Activate": [
    "Активировать"
  ],
  "Activate disks": [
    "Активировать диски"
  ],
  "Activate new disk": [
    "Активировать новый диск"
  ],
  "Activate zFCP disk": [
    "Активировать диск zFCP"
  ],
  "Activated": [
    "Активировано"
  ],
  "Add %s file system": [
    "Добавить файловую систему %s"
  ],
  "Add DNS": [
    "Добавить DNS"
  ],
  "Add a SSH Public Key for root": [
    "Добавить публичный ключ SSH для root"
  ],
  "Add an address": [
    "Добавить адрес"
  ],
  "Add another DNS": [
    "Добавить другой DNS"
  ],
  "Add another address": [
    "Добавить другой адрес"
  ],
  "Add file system": [
    "Добавить файловую систему"
  ],
  "Address": [
    "Адрес"
  ],
  "Addresses": [
    "Адреса"
  ],
  "Addresses data list": [
    "Список данных адресов"
  ],
  "All fields are required": [
    "Все поля обязательны"
  ],
  "All partitions will be removed and any data in the disks will be lost.": [
    "Все разделы будут удалены, а все данные на дисках будут потеряны."
  ],
  "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
    "Позволяет загрузиться в предыдущую версию системы после изменения конфигурации или обновления программного обеспечения."
  ],
  "Already set": [
    "Уже установлен"
  ],
  "An existing disk": [
    "существующий диск"
  ],
  "At least one address must be provided for selected mode": [
    "Для выбранного режима необходимо предоставить не менее одного адреса"
  ],
  "At this point you can power off the machine.": [
    "На этом этапе вы можете выключить устройство."
  ],
  "At this point you can reboot the machine to log in to the new system.": [
    "На этом этапе вы можете перезагрузить устройство, чтобы войти в новую систему."
  ],
  "Authentication by initiator": [
    "Аутентификация инициатором"
  ],
  "Authentication by target": [
    "Аутентификация по цели"
  ],
  "Auto": [
    "Автоматически"
  ],
  "Auto LUNs Scan": [
    "Автоматическое сканирование LUN"
  ],
  "Auto-login": [
    "Автологин"
  ],
  "Automatic": [
    "Автоматически"
  ],
  "Automatic (DHCP)": [
    "Автоматически (DHCP)"
  ],
  "Automatically calculated size according to the selected product.": [
    "Автоматический расчет размера в соответствии с выбранным продуктом."
  ],
  "Available products": [
    "Доступные продукты"
  ],
  "Back": [
    "Назад"
  ],
  "Before %s": [
    "До %s"
  ],
  "Before installing, please check the following problems.": [
    "Проверьте следующие проблемы перед установкой."
  ],
  "Before starting the installation, you need to address the following problems:": [
    "До начала установки нужно устранить следующие проблемы:"
  ],
  "Boot partitions at %s": [
    "Загрузочные разделы на %s"
  ],
  "Boot partitions at installation disk": [
    "Загрузочные разделы на диске для установки"
  ],
  "Btrfs root partition with snapshots (%s)": [
    "Корневой раздел Btrfs с моментальными снимками (%s)"
  ],
  "Btrfs root volume with snapshots (%s)": [
    "Корневой том Btrfs с моментальными снимками (%s)"
  ],
  "Btrfs with snapshots": [
    "Btrfs с моментальными снимками"
  ],
  "Cancel": [
    "Отмена"
  ],
  "Cannot accommodate the required file systems for installation": [
    "Невозможно разместить необходимые файловые системы для установки"
  ],
  "Cannot be changed in remote installation": [
    "Нельзя изменить при удаленной установке"
  ],
  "Cannot connect to Agama server": [
    "Не удалось подключиться к серверу Agama"
  ],
  "Cannot format all selected devices": [
    ""
  ],
  "Change": [
    "Изменить"
  ],
  "Change boot options": [
    "Изменение параметров загрузки"
  ],
  "Change location": [
    "Изменить расположение"
  ],
  "Change product": [
    "Изменить продукт"
  ],
  "Change selection": [
    "Изменить выбор"
  ],
  "Change the root password": [
    "Изменить пароль root"
  ],
  "Channel ID": [
    "Идентификатор канала"
  ],
  "Check the planned action": [
    "Проверить %d запланированное действие",
    "Проверить %d запланированных действия",
    "Проверить %d запланированных действий"
  ],
  "Choose a disk for placing the boot loader": [
    "Выберите диск для размещения загрузчика"
  ],
  "Clear": [
    "Очистить"
  ],
  "Close": [
    "Закрыть"
  ],
  "Configuring the product, please wait ...": [
    "Настройка продукта, пожалуйста, подождите..."
  ],
  "Confirm": [
    "Подтвердить"
  ],
  "Confirm Installation": [
    "Подтвердить установку"
  ],
  "Congratulations!": [
    "Поздравляем!"
  ],
  "Connect": [
    "Подключиться"
  ],
  "Connect to a Wi-Fi network": [
    "Подключиться к сети Wi-Fi"
  ],
  "Connect to hidden network": [
    "Подключиться к скрытой сети"
  ],
  "Connect to iSCSI targets": [
    "Подключение к объектам iSCSI"
  ],
  "Connected": [
    "Подключено"
  ],
  "Connected (%s)": [
    "Подключено (%s)"
  ],
  "Connecting": [
    "Подключение"
  ],
  "Connection actions": [
    "Действия подключения"
  ],
  "Continue": [
    "Продолжить"
  ],
  "Controllers": [
    ""
  ],
  "Could not authenticate against the server, please check it.": [
    "Не удалось пройти аутентификацию на сервере, пожалуйста, проверьте его."
  ],
  "Could not log in. Please, make sure that the password is correct.": [
    "Не удалось войти в систему. Пожалуйста, убедитесь, что пароль введен правильно."
  ],
  "Create a dedicated LVM volume group": [
    "Создать выделенную группу томов LVM"
  ],
  "Create a new partition": [
    "Создать новый раздел"
  ],
  "Create user": [
    "Создать пользователя"
  ],
  "Custom": [
    "По-своему"
  ],
  "DASD %s": [
    "DASD %s"
  ],
  "DIAG": [
    "Режим DIAG"
  ],
  "DNS": [
    "DNS"
  ],
  "Deactivate": [
    "Деактивировать"
  ],
  "Deactivated": [
    "Деактивировано"
  ],
  "Define a user now": [
    "Определить пользователя"
  ],
  "Delete": [
    "Удалить"
  ],
  "Delete current content": [
    "Удалить текущее содержимое"
  ],
  "Destructive actions are allowed": [
    "Разрушительные действия разрешены"
  ],
  "Destructive actions are not allowed": [
    "Разрушительные действия запрещены"
  ],
  "Details": [
    "Подробности"
  ],
  "Device": [
    "Устройство"
  ],
  "Device selector for new LVM volume group": [
    "Выбор устройств для новой группы томов LVM"
  ],
  "Device selector for target disk": [
    "Выбор устройств для целевого диска"
  ],
  "Devices: %s": [
    "Устройства: %s"
  ],
  "Discard": [
    "Отказаться"
  ],
  "Disconnect": [
    "Отключить"
  ],
  "Disconnected": [
    "Отключено"
  ],
  "Discover": [
    "Обнаружить"
  ],
  "Discover iSCSI Targets": [
    "Знакомство с целевыми устройствами iSCSI"
  ],
  "Discover iSCSI targets": [
    "Обнаружение целей iSCSI"
  ],
  "Disk": [
    "Диск"
  ],
  "Disks": [
    "Диски"
  ],
  "Do not configure": [
    "Не настраивать"
  ],
  "Do not configure partitions for booting": [
    "Не настраивать разделы для загрузки"
  ],
  "Do you want to add it?": [
    "Вы хотите добавить её?"
  ],
  "Do you want to edit it?": [
    "Вы хотите изменить её?"
  ],
  "Download logs": [
    "Скачать журналы"
  ],
  "Edit": [
    "Изменить"
  ],
  "Edit %s": [
    "Изменить %s"
  ],
  "Edit %s file system": [
    "Изменить файловую систему %s"
  ],
  "Edit connection %s": [
    "Отредактировать соединение %s"
  ],
  "Edit file system": [
    "Изменить файловую систему"
  ],
  "Edit iSCSI Initiator": [
    "Изменить инициатор iSCSI"
  ],
  "Edit password too": [
    "Также изменить пароль"
  ],
  "Edit the SSH Public Key for root": [
    "Изменить публичный ключ SSH для root"
  ],
  "Edit user": [
    "Изменить пользователя"
  ],
  "Enable": [
    "Включить"
  ],
  "Encrypt the system": [
    "Зашифровать систему"
  ],
  "Encrypted Device": [
    "Зашифрованное устройство"
  ],
  "Encryption": [
    "Шифрование"
  ],
  "Encryption Password": [
    "Пароль шифрования"
  ],
  "Exact size": [
    "Точный размер"
  ],
  "Exact size for the file system.": [
    "Точный размер файловой системы."
  ],
  "File system type": [
    "Тип файловой системы"
  ],
  "File systems created as new partitions at %s": [
    "Файловые системы созданы как новые разделы на %s"
  ],
  "File systems created at a new LVM volume group": [
    "Файловые системы созданы в новой группе томов LVM"
  ],
  "File systems created at a new LVM volume group on %s": [
    "Файловые системы созданы в новой группе томов LVM на %s"
  ],
  "Filter by description or keymap code": [
    "Фильтр по описанию или коду карты клавиш"
  ],
  "Filter by language, territory or locale code": [
    "Фильтр по языку, территории или коду локали"
  ],
  "Filter by max channel": [
    "Фильтр по максимальному каналу"
  ],
  "Filter by min channel": [
    "Фильтр по минимальному каналу"
  ],
  "Filter by pattern title or description": [
    "Фильтр по названию или описанию шаблона"
  ],
  "Filter by territory, time zone code or UTC offset": [
    "Фильтр по территории, коду часового пояса или смещению UTC"
  ],
  "Final layout": [
    "Окончательный вариант"
  ],
  "Finish": [
    "Завершить"
  ],
  "Finished": [
    "Завершено"
  ],
  "First user": [
    "Первый пользователь"
  ],
  "Fixed": [
    "Фиксированный"
  ],
  "Forget": [
    "Забыть"
  ],
  "Forget connection %s": [
    "Забыть соединение %s"
  ],
  "Format": [
    "Формат"
  ],
  "Format the device": [
    "Отформатировать устройство"
  ],
  "Formatted": [
    "Отформатированный"
  ],
  "Formatting DASD devices": [
    "Форматирование устройств DASD"
  ],
  "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
    "Полнодисковое шифрование (FDE) позволяет защитить информацию, хранящуюся на устройстве, включая данные, программы и системные файлы."
  ],
  "Full name": [
    "Полное имя"
  ],
  "Gateway": [
    "Шлюз"
  ],
  "Gateway can be defined only in 'Manual' mode": [
    "Шлюз можно указать только в ручном режиме"
  ],
  "GiB": [
    "ГиБ"
  ],
  "Hide %d subvolume action": [
    "Скрыть %d действие подтома",
    "Скрыть %d действия подтома",
    "Скрыть %d действий подтома"
  ],
  "Hide details": [
    "Скрыть подробности"
  ],
  "IP Address": [
    "IP-адрес"
  ],
  "IP address": [
    "IP-адрес"
  ],
  "IP addresses": [
    "IP-адреса"
  ],
  "If a local media was used to run this installer, remove it before the next boot.": [
    "Если для запуска этой программы установки использовался локальный носитель, извлеките его перед следующей загрузкой."
  ],
  "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
    "Если вы продолжите, разделы на вашем жестком диске будут изменены в соответствии с заданными настройками установки."
  ],
  "In progress": [
    "В процессе"
  ],
  "Incorrect IP address": [
    "Некорректный IP-адрес"
  ],
  "Incorrect password": [
    "Некорректный пароль"
  ],
  "Incorrect port": [
    "Некорректный порт"
  ],
  "Incorrect user name": [
    "Некорректное имя пользователя"
  ],
  "Initiator": [
    "Инициатор"
  ],
  "Initiator name": [
    "Имя инициатора"
  ],
  "Install": [
    "Установить"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) с удалением всего содержимого базовых устройств"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s, удалив все её содержимое"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s, уменьшив существующие разделы по мере необходимости"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s с использованием пользовательской стратегии для поиска необходимого пространства"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s без изменения существующих разделов"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
    "Установите новую группу томов Logical Volume Manager (LVM), уменьшив при необходимости существующие разделы на базовых устройствах"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) с использованием пользовательской стратегии для поиска необходимого пространства на базовых устройствах"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) без изменения разделов на базовых устройствах"
  ],
  "Install new system on": [
    "Установить новую систему на"
  ],
  "Install using device %s and deleting all its content": [
    "Установить с использованием устройства %s и удалить все его содержимое"
  ],
  "Install using device %s shrinking existing partitions as needed": [
    "Установка с использованием устройства %s с уменьшением существующих разделов по мере необходимости"
  ],
  "Install using device %s with a custom strategy to find the needed space": [
    "Установка с использованием устройства %s с помощью пользовательской стратегии поиска необходимого пространства"
  ],
  "Install using device %s without modifying existing partitions": [
    "Установка с использованием устройства %s без изменения существующих разделов"
  ],
  "Installation device": [
    "Устройство для установки"
  ],
  "Installation not possible yet because of issues. Check them at Overview page.": [
    ""
  ],
  "Installation will configure partitions for booting at %s.": [
    "Установка настроит разделы для загрузки по адресу %s."
  ],
  "Installation will configure partitions for booting at the installation disk.": [
    "Установка настроит разделы для загрузки с установочного диска."
  ],
  "Installation will not configure partitions for booting.": [
    "Установка не будет настраивать разделы для загрузки."
  ],
  "Installation will take %s.": [
    "Установка займёт %s."
  ],
  "Installer options": [
    "Параметры установщика"
  ],
  "Interface": [
    "Интерфейс"
  ],
  "Keyboard": [
    "Клавиатура"
  ],
  "Keyboard layout": [
    "Раскладка клавиатуры"
  ],
  "Keyboard selection": [
    "Выбор клавиатуры"
  ],
  "KiB": [
    "КиБ"
  ],
  "LUN": [
    "LUN"
  ],
  "Language": [
    "Язык"
  ],
  "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
    "Ограничения на размер файловой системы. Конечный размер будет равен значению между заданным минимумом и максимумом. Если максимальное значение не задано, то файловая система будет такой большой, на сколько это возможно."
  ],
  "Loading data...": [
    "Загрузка данных..."
  ],
  "Loading installation environment, please wait.": [
    "Загрузка установочной среды, пожалуйста, подождите."
  ],
  "Locale selection": [
    "Выбор локали"
  ],
  "Localization": [
    "Локализация"
  ],
  "Location": [
    "Расположение"
  ],
  "Location for %s file system": [
    "Расположение файловой системы %s"
  ],
  "Log in": [
    "Вход"
  ],
  "Log in as %s": [
    "Вход как %s"
  ],
  "Logical volume at system LVM": [
    "Логический том в системе LVM"
  ],
  "Login": [
    "Вход"
  ],
  "Login %s": [
    "Логин %s"
  ],
  "Login form": [
    "Форма входа"
  ],
  "Logout": [
    "Выход"
  ],
  "Main disk or LVM Volume Group for installation.": [
    "Основной диск или группа томов LVM для установки."
  ],
  "Main navigation": [
    ""
  ],
  "Make sure you provide the correct values": [
    "Убедитесь, что вы указали правильные значения"
  ],
  "Manage and format": [
    "Управление и форматирование"
  ],
  "Manual": [
    "Вручную"
  ],
  "Maximum": [
    "Максимум"
  ],
  "Maximum desired size": [
    "Максимальный желаемый размер"
  ],
  "Maximum must be greater than minimum": [
    "Максимум должен быть больше минимума"
  ],
  "Members: %s": [
    "Участники: %s"
  ],
  "Method": [
    "Метод"
  ],
  "MiB": [
    "МиБ"
  ],
  "Minimum": [
    "Минимум"
  ],
  "Minimum desired size": [
    "Минимальный желаемый размер"
  ],
  "Minimum size is required": [
    "Требуется минимальный размер"
  ],
  "Mode": [
    "Режим"
  ],
  "Modify": [
    "Изменить"
  ],
  "More info for file system types": [
    "Дополнительная информация о типах файловых систем"
  ],
  "Mount %1$s at %2$s (%3$s)": [
    "Установить %1$s в %2$s (%3$s)"
  ],
  "Mount Point": [
    "Точка монтирования"
  ],
  "Mount point": [
    "Точка монтирования"
  ],
  "Mount the file system": [
    "Смонтировать файловую систему"
  ],
  "Multipath": [
    "Многопутевое"
  ],
  "Name": [
    "Имя"
  ],
  "Network": [
    "Сеть"
  ],
  "New": [
    "Новый"
  ],
  "No": [
    "Нет"
  ],
  "No Wi-Fi supported": [
    "Нет поддержки Wi-Fi"
  ],
  "No additional software was selected.": [
    "Никакого дополнительного программного обеспечения выбрано не было."
  ],
  "No connected yet": [
    "Ещё не подключено"
  ],
  "No content found": [
    "Содержимое не найдено"
  ],
  "No device selected yet": [
    "Устройство ещё не выбрано"
  ],
  "No iSCSI targets found.": [
    "Цели iSCSI не найдены."
  ],
  "No partitions will be automatically configured for booting. Use with caution.": [
    "Ни один раздел не будет автоматически настроен для загрузки. Используйте с осторожностью."
  ],
  "No root authentication method defined yet.": [
    "Метод корневой аутентификации пока не определен."
  ],
  "No user defined yet.": [
    "Пользователь еще не определен."
  ],
  "No wired connections found": [
    "Проводные соединения не обнаружены"
  ],
  "No zFCP controllers found.": [
    "Контроллеры zFCP не найдены."
  ],
  "No zFCP disks found.": [
    "Диски zFCP не найдены."
  ],
  "None": [
    "Отсутствует"
  ],
  "None of the keymaps match the filter.": [
    "Ни одна из карт не соответствует фильтру."
  ],
  "None of the locales match the filter.": [
    "Ни одна из локалей не соответствует фильтру."
  ],
  "None of the patterns match the filter.": [
    "Ни один из шаблонов не соответствует фильтру."
  ],
  "None of the time zones match the filter.": [
    "Ни один из часовых поясов не соответствует фильтру."
  ],
  "Not selected yet": [
    "Ещё не выбрано"
  ],
  "Not set": [
    "Не установлен"
  ],
  "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
    ""
  ],
  "Offload card": [
    "Разгрузочная карта"
  ],
  "On boot": [
    "При загрузке"
  ],
  "Only available if authentication by target is provided": [
    "Доступно только при условии аутентификации по цели"
  ],
  "Other": [
    "Другая"
  ],
  "Overview": [
    "Обзор"
  ],
  "Partition Info": [
    "Информация о разделе"
  ],
  "Partition at %s": [
    "Раздел на %s"
  ],
  "Partition at installation disk": [
    "Раздел на диске для установки"
  ],
  "Partitions and file systems": [
    "Разделы и файловые системы"
  ],
  "Partitions to boot will be allocated at the following device.": [
    "Загрузочные разделы будут выделены на следующем устройстве."
  ],
  "Partitions to boot will be allocated at the installation disk (%s).": [
    "Загрузочные разделы будут выделены на установочном диске (%s)."
  ],
  "Partitions to boot will be allocated at the installation disk.": [
    "Загрузочные разделы будут выделены на установочном диске."
  ],
  "Password": [
    "Пароль"
  ],
  "Password Required": [
    "Необходим пароль"
  ],
  "Password confirmation": [
    "Подтверждение пароля"
  ],
  "Password input": [
    "Ввод пароля"
  ],
  "Password visibility button": [
    "Кнопка отображения пароля"
  ],
  "Passwords do not match": [
    "Пароли не совпадают"
  ],
  "Pending": [
    "Ожидается"
  ],
  "Perform an action": [
    "Выполнить действие"
  ],
  "PiB": [
    "ПиБ"
  ],
  "Planned Actions": [
    "Планируемые действия"
  ],
  "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
    "Обратите внимание, что перед установкой системы необходимо определить пользователя, чтобы он мог войти в систему."
  ],
  "Please, cancel and check the settings if you are unsure.": [
    "Пожалуйста, отмените и проверьте настройки, если вы не уверены."
  ],
  "Please, check whether it is running.": [
    "Пожалуйста, проверьте, запущен ли он."
  ],
  "Please, define at least one authentication method for logging into the system as root.": [
    "Пожалуйста, определите хотя бы один метод аутентификации для входа в систему с правами root."
  ],
  "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
    "Выполните обнаружение iSCSI, чтобы найти доступные цели iSCSI."
  ],
  "Please, provide its password to log in to the system.": [
    "Пожалуйста, укажите его пароль для входа в систему."
  ],
  "Please, review provided settings and try again.": [
    "Пожалуйста, проверьте предоставленные настройки и попробуйте ещё раз."
  ],
  "Please, try to activate a zFCP controller.": [
    "Пожалуйста, попробуйте активировать контроллер zFCP."
  ],
  "Please, try to activate a zFCP disk.": [
    "Пожалуйста, попробуйте активировать диск zFCP."
  ],
  "Port": [
    "Порт"
  ],
  "Portal": [
    "Портал"
  ],
  "Prefix length or netmask": [
    "Длина префикса или маска сети"
  ],
  "Prepare more devices by configuring advanced": [
    "Подготовьте больше устройств, настроив расширенные"
  ],
  "Presence of other volumes (%s)": [
    "Наличие других томов (%s)"
  ],
  "Protection for the information stored at the device, including data, programs, and system files.": [
    "Защита информации, хранящейся на устройстве, включая данные, программы и системные файлы."
  ],
  "Question": [
    "Вопрос"
  ],
  "Range": [
    "Диапазон"
  ],
  "Read zFCP devices": [
    "Прочитать устройства zFCP"
  ],
  "Reboot": [
    "Перезагрузка"
  ],
  "Reload": [
    "Обновить"
  ],
  "Remove": [
    "Удалить"
  ],
  "Remove max channel filter": [
    "Удалить фильтр по максимальному каналу"
  ],
  "Remove min channel filter": [
    "Удалить фильтр по минимальному каналу"
  ],
  "Reset location": [
    "Сбросить расположение"
  ],
  "Reset to defaults": [
    "Сбросить по умолчанию"
  ],
  "Reused %s": [
    "Повторно используется %s"
  ],
  "Root SSH public key": [
    "Публичный ключ SSH для root"
  ],
  "Root authentication": [
    "Аутентификация root"
  ],
  "Root password": [
    "Пароль root"
  ],
  "SD Card": [
    "SD-карта"
  ],
  "SSH Key": [
    "Ключ SSH"
  ],
  "SSID": [
    "Имя сети"
  ],
  "Search": [
    "Поиск"
  ],
  "Security": [
    "Защита"
  ],
  "See more details": [
    "См. подробнее"
  ],
  "Select": [
    "Выбор"
  ],
  "Select a disk": [
    "Выберите диск"
  ],
  "Select a location": [
    "Выберите расположение"
  ],
  "Select booting partition": [
    "Выберите загрузочный раздел"
  ],
  "Select how to allocate the file system": [
    "Выберите способ выделения файловой системы"
  ],
  "Select in which device to allocate the file system": [
    "Выберите, на каком устройстве разместить файловую систему"
  ],
  "Select installation device": [
    "Выберите устройство для установки"
  ],
  "Select what to do with each partition.": [
    "Выберите, что делать с каждым разделом."
  ],
  "Selected patterns": [
    "Выбранные шаблоны"
  ],
  "Separate LVM at %s": [
    "Отдельный LVM на %s"
  ],
  "Server IP": [
    "IP сервера"
  ],
  "Set": [
    "Установить"
  ],
  "Set DIAG Off": [
    "Отключить DIAG"
  ],
  "Set DIAG On": [
    "Включить DIAG"
  ],
  "Set a password": [
    "Установить пароль"
  ],
  "Set a root password": [
    "Установить пароль root"
  ],
  "Set root SSH public key": [
    "Установить публичный ключ SSH для root"
  ],
  "Show %d subvolume action": [
    "Показать %d действие подтома",
    "Показать %d действия подтома",
    "Показать %d действий подтома"
  ],
  "Show information about %s": [
    "Показать сведения о %s"
  ],
  "Show partitions and file-systems actions": [
    "Показать разделы и действия с файловыми системами"
  ],
  "Shrink existing partitions": [
    "Уменьшение существующих разделов"
  ],
  "Shrinking partitions is allowed": [
    "Сокращение разделов разрешено"
  ],
  "Shrinking partitions is not allowed": [
    "Сокращение разделов запрещено"
  ],
  "Shrinking some partitions is allowed but not needed": [
    "Сокращение некоторых разделов разрешено, но не нужно"
  ],
  "Size": [
    "Размер"
  ],
  "Size unit": [
    "Единица измерения"
  ],
  "Software": [
    "Программы"
  ],
  "Software %s": [
    "Программное обеспечение %s"
  ],
  "Software selection": [
    "Выбор программного обеспечения"
  ],
  "Something went wrong": [
    "Что-то пошло не так"
  ],
  "Space policy": [
    "Политика пространства"
  ],
  "Startup": [
    "Запуск"
  ],
  "Status": [
    "Состояние"
  ],
  "Storage": [
    "Хранилище"
  ],
  "Storage proposal not possible": [
    "Не могу предложить организацию хранилища"
  ],
  "Structure of the new system, including any additional partition needed for booting": [
    "Структура новой системы, включая все дополнительные разделы, необходимые для загрузки"
  ],
  "Swap at %1$s (%2$s)": [
    "Подкачка на %1$s (%2$s)"
  ],
  "Swap partition (%s)": [
    "Раздел подкачки (%s)"
  ],
  "Swap volume (%s)": [
    "Том для подкачки (%s)"
  ],
  "TPM sealing requires the new system to be booted directly.": [
    "Запечатывание TPM требует прямой загрузки новой системы."
  ],
  "Table with mount points": [
    "Таблица с точками монтирования"
  ],
  "Take your time to check your configuration before starting the installation process.": [
    "Проверьте свои настройки до начала процесса установки."
  ],
  "Target Password": [
    "Пароль цели"
  ],
  "Targets": [
    "Цели"
  ],
  "The amount of RAM in the system": [
    "Объем ОЗУ в системе"
  ],
  "The configuration of snapshots": [
    "Конфигурация моментальных снимков"
  ],
  "The content may be deleted": [
    "Содержимое может быть удалено"
  ],
  "The current file system on %s is selected to be mounted at %s.": [
    "Текущая файловая система на %s выбрана для монтирования в %s."
  ],
  "The current file system on the selected device will be mounted   without formatting the device.": [
    "Текущая файловая система на выбранном устройстве будет смонтирована   без форматирования устройства."
  ],
  "The data is kept, but the current partitions will be resized as needed.": [
    "Данные сохраняются, но размер текущих разделов будет изменен по мере необходимости."
  ],
  "The data is kept. Only the space not assigned to any partition will be used.": [
    "Данные сохраняются. Будет использовано только пространство, не отведенное для какого-либо раздела."
  ],
  "The device cannot be shrunk:": [
    "Устройство не может быть сокращено:"
  ],
  "The file system is allocated at the device %s.": [
    "Файловая система выделена на устройстве %s."
  ],
  "The file system will be allocated as a new partition at the selected   disk.": [
    "Файловая система будет выделена в качестве нового раздела на выбранном   диске."
  ],
  "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
    "По умолчанию файловые системы распределяются на устройстве установки. Укажите пользовательское расположение, чтобы создать файловую систему на конкретном устройстве."
  ],
  "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
    "Файловые системы по умолчанию будут выделены как [логические тома новой группы томов LVM]. Соответствующие физические тома будут создаваться по требованию как новые разделы на выбранных устройствах."
  ],
  "The file systems will be allocated by default as [new partitions in the selected device].": [
    "Файловые системы будут выделены по умолчанию как [новые разделы на выбранном устройстве]."
  ],
  "The final size depends on %s.": [
    "Итоговый размер зависит от %s."
  ],
  "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
    "Последний шаг по настройке Доверенного платформенного модуля (TPM) на автоматическое открытие зашифрованных устройств будет выполнен во время первой загрузки новой системы. Чтобы это сработало, машина должна загрузиться непосредственно в новый загрузчик."
  ],
  "The following software patterns are selected for installation:": [
    "Для установки выбраны следующие образцы программного обеспечения:"
  ],
  "The installation on your machine is complete.": [
    "Установка на ваш компьютер завершена."
  ],
  "The installation will take": [
    "Установка займёт"
  ],
  "The installation will take %s including:": [
    "Установка займёт %s, в том числе:"
  ],
  "The installer requires [root] user privileges.": [
    "Программа установки требует привилегий пользователя [root]."
  ],
  "The mount point is invalid": [
    "Точка монтирования недопустима"
  ],
  "The options for the file system type depends on the product and the mount point.": [
    "Параметры типа файловой системы зависят от продукта и точки монтирования."
  ],
  "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
    "Пароль не понадобится для загрузки и доступа к данным, если TPM может проверить целостность системы. Запечатывание TPM требует непосредственной загрузки новой системы при первом запуске."
  ],
  "The selected device will be formatted as %s file system.": [
    "Выбранное устройство будет отформатировано в файловую систему %s."
  ],
  "The size of the file system cannot be edited": [
    "Размер файловой системы не может быть изменен"
  ],
  "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
    "Система не поддерживает соединение по WiFi, вероятно, из-за отсутствующего или отключённого оборудования."
  ],
  "The system has not been configured for connecting to a Wi-Fi network yet.": [
    "Система ещё не настроена на подключение к сети Wi-Fi."
  ],
  "The system will use %s as its default language.": [
    "Система будет использовать %s в качестве языка по умолчанию."
  ],
  "The systems will be configured as displayed below.": [
    "Системы будут настроены, как показано ниже."
  ],
  "The type and size of the file system cannot be edited.": [
    "Тип и размер файловой системы редактировать нельзя."
  ],
  "The zFCP disk was not activated.": [
    "Диск zFCP не был активирован."
  ],
  "There is a predefined file system for %s.": [
    "Существует предопределенная файловая система для %s."
  ],
  "There is already a file system for %s.": [
    "Для %s уже существует файловая система."
  ],
  "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
    "Это наиболее актуальные настройки установки. Более подробные сведения приведены в разделах меню."
  ],
  "These limits are affected by:": [
    "На эти ограничения влияют:"
  ],
  "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
    ""
  ],
  "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
    "Данный продукт не позволяет выбирать шаблоны программного обеспечения во время установки. Однако Вы можете добавить дополнительное программное обеспечение после завершения установки."
  ],
  "This space includes the base system and the selected software patterns, if any.": [
    "Это пространство включает в себя базовую систему и выбранные шаблоны программного обеспечения, если таковые имеются."
  ],
  "TiB": [
    "ТиБ"
  ],
  "Time zone": [
    "Часовой пояс"
  ],
  "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
    "Чтобы обеспечить загрузку новой системы, программе установки может потребоваться создать или настроить некоторые разделы на соответствующем диске."
  ],
  "Transactional Btrfs": [
    "Транзакционная Btrfs"
  ],
  "Transactional Btrfs root partition (%s)": [
    "Корневой раздел Btrfs с транзакциями (%s)"
  ],
  "Transactional Btrfs root volume (%s)": [
    "Корневой том Btrfs с транзакциями (%s)"
  ],
  "Transactional root file system": [
    "Транзакционная корневая файловая система"
  ],
  "Type": [
    "Тип"
  ],
  "Unit for the maximum size": [
    "Единица для максимального размера"
  ],
  "Unit for the minimum size": [
    "Единица для минимального размера"
  ],
  "Unused space": [
    "Неиспользуемое пространство"
  ],
  "Up to %s can be recovered by shrinking the device.": [
    "До %s можно освободить, сократив устройство."
  ],
  "Upload": [
    "Загрузить"
  ],
  "Upload a SSH Public Key": [
    "Загрузить публичный ключ SSH"
  ],
  "Upload, paste, or drop an SSH public key": [
    "Загрузите, вставьте или сбросьте публичный ключ SSH"
  ],
  "Usage": [
    "Использование"
  ],
  "Use Btrfs snapshots for the root file system": [
    "Используйте моментальные снимки Btrfs для корневой файловой системы"
  ],
  "Use available space": [
    "Использовать свободное пространство"
  ],
  "Use suggested username": [
    "Используйте предложенное имя пользователя"
  ],
  "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
    "Используйте Доверенный платформенный модуль (TPM) для автоматического дешифрования при каждой загрузке"
  ],
  "User full name": [
    "Полное имя пользователя"
  ],
  "User name": [
    "Имя пользователя"
  ],
  "Username": [
    "Имя пользователя"
  ],
  "Username suggestion dropdown": [
    "Выпадающий список с предложением имени пользователя"
  ],
  "Users": [
    "Пользователи"
  ],
  "WPA & WPA2 Personal": [
    "WPA и WPA2 Personal"
  ],
  "WPA Password": [
    "Пароль WPA"
  ],
  "WWPN": [
    "WWPN"
  ],
  "Waiting": [
    "Ожидание"
  ],
  "Waiting for actions information...": [
    "Ожидание информации о действиях..."
  ],
  "Waiting for information about storage configuration": [
    "Ожидание информации о конфигурации хранилища"
  ],
  "Wi-Fi": [
    "Wi-Fi"
  ],
  "Wired": [
    "Проводное"
  ],
  "Wires: %s": [
    "Проводки: %s"
  ],
  "Yes": [
    "Да"
  ],
  "ZFCP": [
    ""
  ],
  "affecting": [
    "влияя на"
  ],
  "at least %s": [
    "не менее %s"
  ],
  "auto": [
    "автоматически"
  ],
  "auto selected": [
    "автоматический выбор"
  ],
  "configured": [
    "настроено"
  ],
  "deleting current content": [
    "удаление текущего содержимого"
  ],
  "disabled": [
    "отключено"
  ],
  "enabled": [
    "включено"
  ],
  "iBFT": [
    "iBFT"
  ],
  "iSCSI": [
    "iSCSI"
  ],
  "shrinking partitions": [
    "уменьшение разделов"
  ],
  "storage techs": [
    "технологии хранения"
  ],
  "the amount of RAM in the system": [
    "объем ОЗУ в системе"
  ],
  "the configuration of snapshots": [
    "конфигурация моментальных снимков"
  ],
  "the presence of the file system for %s": [
    "наличие файловой системы для %s"
  ],
  "user autologin": [
    "автоматический вход пользователя"
  ],
  "using TPM unlocking": [
    "используя разблокировку TPM"
  ],
  "with custom actions": [
    "другими способами"
  ],
  "without modifying any partition": [
    "не изменяя ни одного раздела"
  ],
  "zFCP": [
    "zFCP"
  ],
  "zFCP Disk Activation": [
    ""
  ],
  "zFCP Disk activation form": [
    ""
  ]
});
