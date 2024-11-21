import agama from "../agama";

agama.locale({
  "": {
    "plural-forms": (n) => n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2,
    "language": "ru"
  },
  "Change product": [
    "Изменить продукт"
  ],
  "Confirm Installation": [
    "Подтвердить установку"
  ],
  "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
    "Если вы продолжите, разделы на вашем жестком диске будут изменены в соответствии с заданными настройками установки."
  ],
  "Please, cancel and check the settings if you are unsure.": [
    "Пожалуйста, отмените и проверьте настройки, если вы не уверены."
  ],
  "Continue": [
    "Продолжить"
  ],
  "Cancel": [
    "Отмена"
  ],
  "Install": [
    "Установить"
  ],
  "TPM sealing requires the new system to be booted directly.": [
    "Запечатывание TPM требует прямой загрузки новой системы."
  ],
  "If a local media was used to run this installer, remove it before the next boot.": [
    "Если для запуска этой программы установки использовался локальный носитель, извлеките его перед следующей загрузкой."
  ],
  "Hide details": [
    "Скрыть подробности"
  ],
  "See more details": [
    "См. подробнее"
  ],
  "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
    "Последний шаг по настройке Доверенного платформенного модуля (TPM) на автоматическое открытие зашифрованных устройств будет выполнен во время первой загрузки новой системы. Чтобы это сработало, машина должна загрузиться непосредственно в новый загрузчик."
  ],
  "Congratulations!": [
    "Поздравляем!"
  ],
  "The installation on your machine is complete.": [
    "Установка на ваш компьютер завершена."
  ],
  "At this point you can power off the machine.": [
    "На этом этапе вы можете выключить устройство."
  ],
  "At this point you can reboot the machine to log in to the new system.": [
    "На этом этапе вы можете перезагрузить устройство, чтобы войти в новую систему."
  ],
  "Finish": [
    "Завершить"
  ],
  "Reboot": [
    "Перезагрузка"
  ],
  "Installer options": [
    "Параметры установщика"
  ],
  "Language": [
    "Язык"
  ],
  "Keyboard layout": [
    "Раскладка клавиатуры"
  ],
  "Cannot be changed in remote installation": [
    "Нельзя изменить при удаленной установке"
  ],
  "Accept": [
    "Подтвердить"
  ],
  "Before starting the installation, you need to address the following problems:": [
    "До начала установки нужно устранить следующие проблемы:"
  ],
  "Installation not possible yet because of issues. Check them at Overview page.": [
    ""
  ],
  "Search": [
    "Поиск"
  ],
  "Could not log in. Please, make sure that the password is correct.": [
    "Не удалось войти в систему. Пожалуйста, убедитесь, что пароль введен правильно."
  ],
  "Could not authenticate against the server, please check it.": [
    "Не удалось пройти аутентификацию на сервере, пожалуйста, проверьте его."
  ],
  "Log in as %s": [
    "Вход как %s"
  ],
  "The installer requires [root] user privileges.": [
    "Программа установки требует привилегий пользователя [root]."
  ],
  "Please, provide its password to log in to the system.": [
    "Пожалуйста, укажите его пароль для входа в систему."
  ],
  "Login form": [
    "Форма входа"
  ],
  "Password input": [
    "Ввод пароля"
  ],
  "Log in": [
    "Вход"
  ],
  "Back": [
    "Назад"
  ],
  "Passwords do not match": [
    "Пароли не совпадают"
  ],
  "Password": [
    "Пароль"
  ],
  "Password confirmation": [
    "Подтверждение пароля"
  ],
  "Password visibility button": [
    "Кнопка отображения пароля"
  ],
  "Confirm": [
    "Подтвердить"
  ],
  "Loading data...": [
    "Загрузка данных..."
  ],
  "Pending": [
    "Ожидается"
  ],
  "In progress": [
    "В процессе"
  ],
  "Finished": [
    "Завершено"
  ],
  "Actions": [
    "Действия"
  ],
  "Waiting": [
    "Ожидание"
  ],
  "Cannot connect to Agama server": [
    "Не удалось подключиться к серверу Agama"
  ],
  "Please, check whether it is running.": [
    "Пожалуйста, проверьте, запущен ли он."
  ],
  "Reload": [
    "Обновить"
  ],
  "Filter by description or keymap code": [
    "Фильтр по описанию или коду карты клавиш"
  ],
  "None of the keymaps match the filter.": [
    "Ни одна из карт не соответствует фильтру."
  ],
  "Keyboard selection": [
    "Выбор клавиатуры"
  ],
  "Select": [
    "Выбор"
  ],
  "Localization": [
    "Локализация"
  ],
  "Not selected yet": [
    "Ещё не выбрано"
  ],
  "Change": [
    "Изменить"
  ],
  "Keyboard": [
    "Клавиатура"
  ],
  "Time zone": [
    "Часовой пояс"
  ],
  "Filter by language, territory or locale code": [
    "Фильтр по языку, территории или коду локали"
  ],
  "None of the locales match the filter.": [
    "Ни одна из локалей не соответствует фильтру."
  ],
  "Locale selection": [
    "Выбор локали"
  ],
  "Filter by territory, time zone code or UTC offset": [
    "Фильтр по территории, коду часового пояса или смещению UTC"
  ],
  "None of the time zones match the filter.": [
    "Ни один из часовых поясов не соответствует фильтру."
  ],
  " Timezone selection": [
    " Выбор часового пояса"
  ],
  "Download logs": [
    "Скачать журналы"
  ],
  "Main navigation": [
    ""
  ],
  "Loading installation environment, please wait.": [
    "Загрузка установочной среды, пожалуйста, подождите."
  ],
  "Remove": [
    "Удалить"
  ],
  "IP Address": [
    "IP-адрес"
  ],
  "Prefix length or netmask": [
    "Длина префикса или маска сети"
  ],
  "Add an address": [
    "Добавить адрес"
  ],
  "Add another address": [
    "Добавить другой адрес"
  ],
  "Addresses": [
    "Адреса"
  ],
  "Addresses data list": [
    "Список данных адресов"
  ],
  "Name": [
    "Имя"
  ],
  "IP addresses": [
    "IP-адреса"
  ],
  "Connection actions": [
    "Действия подключения"
  ],
  "Edit": [
    "Изменить"
  ],
  "Edit connection %s": [
    "Отредактировать соединение %s"
  ],
  "Forget": [
    "Забыть"
  ],
  "Forget connection %s": [
    "Забыть соединение %s"
  ],
  "Actions for connection %s": [
    "Действия для соединения %s"
  ],
  "Server IP": [
    "IP сервера"
  ],
  "Add DNS": [
    "Добавить DNS"
  ],
  "Add another DNS": [
    "Добавить другой DNS"
  ],
  "DNS": [
    "DNS"
  ],
  "At least one address must be provided for selected mode": [
    "Для выбранного режима необходимо предоставить не менее одного адреса"
  ],
  "Mode": [
    "Режим"
  ],
  "Automatic (DHCP)": [
    "Автоматически (DHCP)"
  ],
  "Manual": [
    "Вручную"
  ],
  "Gateway": [
    "Шлюз"
  ],
  "Gateway can be defined only in 'Manual' mode": [
    "Шлюз можно указать только в ручном режиме"
  ],
  "Wired": [
    "Проводное"
  ],
  "No wired connections found": [
    "Проводные соединения не обнаружены"
  ],
  "Wi-Fi": [
    "Wi-Fi"
  ],
  "Connect": [
    "Подключиться"
  ],
  "No connected yet": [
    "Ещё не подключено"
  ],
  "The system has not been configured for connecting to a Wi-Fi network yet.": [
    "Система ещё не настроена на подключение к сети Wi-Fi."
  ],
  "No Wi-Fi supported": [
    "Нет поддержки Wi-Fi"
  ],
  "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
    "Система не поддерживает соединение по WiFi, вероятно, из-за отсутствующего или отключённого оборудования."
  ],
  "Network": [
    "Сеть"
  ],
  "None": [
    "Отсутствует"
  ],
  "WPA & WPA2 Personal": [
    "WPA и WPA2 Personal"
  ],
  "Something went wrong": [
    "Что-то пошло не так"
  ],
  "Please, review provided settings and try again.": [
    "Пожалуйста, проверьте предоставленные настройки и попробуйте ещё раз."
  ],
  "SSID": [
    "Имя сети"
  ],
  "Security": [
    "Защита"
  ],
  "WPA Password": [
    "Пароль WPA"
  ],
  "Connecting": [
    "Подключение"
  ],
  "Connected": [
    "Подключено"
  ],
  "Disconnected": [
    "Отключено"
  ],
  "Disconnect": [
    "Отключить"
  ],
  "Connect to hidden network": [
    "Подключиться к скрытой сети"
  ],
  "configured": [
    "настроено"
  ],
  "Connect to a Wi-Fi network": [
    "Подключиться к сети Wi-Fi"
  ],
  "The system will use %s as its default language.": [
    "Система будет использовать %s в качестве языка по умолчанию."
  ],
  "Users": [
    "Пользователи"
  ],
  "Storage": [
    "Хранилище"
  ],
  "Software": [
    "Программы"
  ],
  "Before installing, please check the following problems.": [
    "Проверьте следующие проблемы перед установкой."
  ],
  "Overview": [
    "Обзор"
  ],
  "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
    "Это наиболее актуальные настройки установки. Более подробные сведения приведены в разделах меню."
  ],
  "Take your time to check your configuration before starting the installation process.": [
    "Проверьте свои настройки до начала процесса установки."
  ],
  "The installation will take": [
    "Установка займёт"
  ],
  "The installation will take %s including:": [
    "Установка займёт %s, в том числе:"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
    "Установите новую группу томов Logical Volume Manager (LVM), уменьшив при необходимости существующие разделы на базовых устройствах"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) без изменения разделов на базовых устройствах"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) с удалением всего содержимого базовых устройств"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
    "Установка в новую группу томов Logical Volume Manager (LVM) с использованием пользовательской стратегии для поиска необходимого пространства на базовых устройствах"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s, уменьшив существующие разделы по мере необходимости"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s без изменения существующих разделов"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s, удалив все её содержимое"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
    "Установка в новую группу томов Logical Volume Manager (LVM) на %s с использованием пользовательской стратегии для поиска необходимого пространства"
  ],
  "No device selected yet": [
    "Устройство ещё не выбрано"
  ],
  "Install using device %s shrinking existing partitions as needed": [
    "Установка с использованием устройства %s с уменьшением существующих разделов по мере необходимости"
  ],
  "Install using device %s without modifying existing partitions": [
    "Установка с использованием устройства %s без изменения существующих разделов"
  ],
  "Install using device %s and deleting all its content": [
    "Установить с использованием устройства %s и удалить все его содержимое"
  ],
  "Install using device %s with a custom strategy to find the needed space": [
    "Установка с использованием устройства %s с помощью пользовательской стратегии поиска необходимого пространства"
  ],
  "%s logo": [
    ""
  ],
  "Available products": [
    "Доступные продукты"
  ],
  "Configuring the product, please wait ...": [
    "Настройка продукта, пожалуйста, подождите..."
  ],
  "Question": [
    "Вопрос"
  ],
  "Encrypted Device": [
    "Зашифрованное устройство"
  ],
  "Encryption Password": [
    "Пароль шифрования"
  ],
  "Password Required": [
    "Необходим пароль"
  ],
  "No additional software was selected.": [
    "Никакого дополнительного программного обеспечения выбрано не было."
  ],
  "The following software patterns are selected for installation:": [
    "Для установки выбраны следующие образцы программного обеспечения:"
  ],
  "Selected patterns": [
    "Выбранные шаблоны"
  ],
  "Change selection": [
    "Изменить выбор"
  ],
  "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
    "Данный продукт не позволяет выбирать шаблоны программного обеспечения во время установки. Однако Вы можете добавить дополнительное программное обеспечение после завершения установки."
  ],
  "None of the patterns match the filter.": [
    "Ни один из шаблонов не соответствует фильтру."
  ],
  "auto selected": [
    "автоматический выбор"
  ],
  "Software selection": [
    "Выбор программного обеспечения"
  ],
  "Filter by pattern title or description": [
    "Фильтр по названию или описанию шаблона"
  ],
  "Close": [
    "Закрыть"
  ],
  "Installation will take %s.": [
    "Установка займёт %s."
  ],
  "This space includes the base system and the selected software patterns, if any.": [
    "Это пространство включает в себя базовую систему и выбранные шаблоны программного обеспечения, если таковые имеются."
  ],
  "Change boot options": [
    "Изменение параметров загрузки"
  ],
  "Installation will not configure partitions for booting.": [
    "Установка не будет настраивать разделы для загрузки."
  ],
  "Installation will configure partitions for booting at the installation disk.": [
    "Установка настроит разделы для загрузки с установочного диска."
  ],
  "Installation will configure partitions for booting at %s.": [
    "Установка настроит разделы для загрузки по адресу %s."
  ],
  "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
    "Чтобы обеспечить загрузку новой системы, программе установки может потребоваться создать или настроить некоторые разделы на соответствующем диске."
  ],
  "Partitions to boot will be allocated at the installation disk.": [
    "Загрузочные разделы будут выделены на установочном диске."
  ],
  "Partitions to boot will be allocated at the installation disk (%s).": [
    "Загрузочные разделы будут выделены на установочном диске (%s)."
  ],
  "Select booting partition": [
    "Выберите загрузочный раздел"
  ],
  "Automatic": [
    "Автоматически"
  ],
  "Select a disk": [
    "Выберите диск"
  ],
  "Partitions to boot will be allocated at the following device.": [
    "Загрузочные разделы будут выделены на следующем устройстве."
  ],
  "Choose a disk for placing the boot loader": [
    "Выберите диск для размещения загрузчика"
  ],
  "Do not configure": [
    "Не настраивать"
  ],
  "No partitions will be automatically configured for booting. Use with caution.": [
    "Ни один раздел не будет автоматически настроен для загрузки. Используйте с осторожностью."
  ],
  "The file systems will be allocated by default as [new partitions in the selected device].": [
    "Файловые системы будут выделены по умолчанию как [новые разделы на выбранном устройстве]."
  ],
  "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
    "Файловые системы по умолчанию будут выделены как [логические тома новой группы томов LVM]. Соответствующие физические тома будут создаваться по требованию как новые разделы на выбранных устройствах."
  ],
  "Select installation device": [
    "Выберите устройство для установки"
  ],
  "Install new system on": [
    "Установить новую систему на"
  ],
  "An existing disk": [
    "существующий диск"
  ],
  "A new LVM Volume Group": [
    "новую группу томов LVM"
  ],
  "Device selector for target disk": [
    "Выбор устройств для целевого диска"
  ],
  "Device selector for new LVM volume group": [
    "Выбор устройств для новой группы томов LVM"
  ],
  "Prepare more devices by configuring advanced": [
    "Подготовьте больше устройств, настроив расширенные"
  ],
  "storage techs": [
    "технологии хранения"
  ],
  "Multipath": [
    "Многопутевое"
  ],
  "DASD %s": [
    "DASD %s"
  ],
  "Software %s": [
    "Программное обеспечение %s"
  ],
  "SD Card": [
    "SD-карта"
  ],
  "%s disk": [
    "Диск %s"
  ],
  "Disk": [
    "Диск"
  ],
  "Members: %s": [
    "Участники: %s"
  ],
  "Devices: %s": [
    "Устройства: %s"
  ],
  "Wires: %s": [
    "Проводки: %s"
  ],
  "%s with %d partitions": [
    "%s с %d разделами"
  ],
  "No content found": [
    "Содержимое не найдено"
  ],
  "Device": [
    "Устройство"
  ],
  "Details": [
    "Подробности"
  ],
  "Size": [
    "Размер"
  ],
  "Manage and format": [
    "Управление и форматирование"
  ],
  "Activate disks": [
    "Активировать диски"
  ],
  "zFCP": [
    "zFCP"
  ],
  "Connect to iSCSI targets": [
    "Подключение к объектам iSCSI"
  ],
  "iSCSI": [
    "iSCSI"
  ],
  "disabled": [
    "отключено"
  ],
  "enabled": [
    "включено"
  ],
  "using TPM unlocking": [
    "используя разблокировку TPM"
  ],
  "Enable": [
    "Включить"
  ],
  "Modify": [
    "Изменить"
  ],
  "Encryption": [
    "Шифрование"
  ],
  "Protection for the information stored at the device, including data, programs, and system files.": [
    "Защита информации, хранящейся на устройстве, включая данные, программы и системные файлы."
  ],
  "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
    "Используйте Доверенный платформенный модуль (TPM) для автоматического дешифрования при каждой загрузке"
  ],
  "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
    "Пароль не понадобится для загрузки и доступа к данным, если TPM может проверить целостность системы. Запечатывание TPM требует непосредственной загрузки новой системы при первом запуске."
  ],
  "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
    "Полнодисковое шифрование (FDE) позволяет защитить информацию, хранящуюся на устройстве, включая данные, программы и системные файлы."
  ],
  "Encrypt the system": [
    "Зашифровать систему"
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
  "Main disk or LVM Volume Group for installation.": [
    "Основной диск или группа томов LVM для установки."
  ],
  "Installation device": [
    "Устройство для установки"
  ],
  "Maximum must be greater than minimum": [
    "Максимум должен быть больше минимума"
  ],
  "at least %s": [
    "не менее %s"
  ],
  "Transactional Btrfs root volume (%s)": [
    "Корневой том Btrfs с транзакциями (%s)"
  ],
  "Transactional Btrfs root partition (%s)": [
    "Корневой раздел Btrfs с транзакциями (%s)"
  ],
  "Btrfs root volume with snapshots (%s)": [
    "Корневой том Btrfs с моментальными снимками (%s)"
  ],
  "Btrfs root partition with snapshots (%s)": [
    "Корневой раздел Btrfs с моментальными снимками (%s)"
  ],
  "Mount %1$s at %2$s (%3$s)": [
    "Установить %1$s в %2$s (%3$s)"
  ],
  "Swap at %1$s (%2$s)": [
    "Подкачка на %1$s (%2$s)"
  ],
  "Swap volume (%s)": [
    "Том для подкачки (%s)"
  ],
  "Swap partition (%s)": [
    "Раздел подкачки (%s)"
  ],
  "%1$s root at %2$s (%3$s)": [
    "%1$s корень на %2$s (%3$s)"
  ],
  "%1$s root volume (%2$s)": [
    "Корневой том %1$s (%2$s)"
  ],
  "%1$s root partition (%2$s)": [
    "Корневой раздел %1$s (%2$s)"
  ],
  "%1$s %2$s at %3$s (%4$s)": [
    "%1$s %2$s на %3$s (%4$s)"
  ],
  "%1$s %2$s volume (%3$s)": [
    "%1$s том %2$s (%3$s)"
  ],
  "%1$s %2$s partition (%3$s)": [
    "%1$s раздел %2$s (%3$s)"
  ],
  "Do not configure partitions for booting": [
    "Не настраивать разделы для загрузки"
  ],
  "Boot partitions at installation disk": [
    "Загрузочные разделы на диске для установки"
  ],
  "Boot partitions at %s": [
    "Загрузочные разделы на %s"
  ],
  "These limits are affected by:": [
    "На эти ограничения влияют:"
  ],
  "The configuration of snapshots": [
    "Конфигурация моментальных снимков"
  ],
  "Presence of other volumes (%s)": [
    "Наличие других томов (%s)"
  ],
  "The amount of RAM in the system": [
    "Объем ОЗУ в системе"
  ],
  "auto": [
    "автоматически"
  ],
  "Reused %s": [
    "Повторно используется %s"
  ],
  "Transactional Btrfs": [
    "Транзакционная Btrfs"
  ],
  "Btrfs with snapshots": [
    "Btrfs с моментальными снимками"
  ],
  "Partition at %s": [
    "Раздел на %s"
  ],
  "Separate LVM at %s": [
    "Отдельный LVM на %s"
  ],
  "Logical volume at system LVM": [
    "Логический том в системе LVM"
  ],
  "Partition at installation disk": [
    "Раздел на диске для установки"
  ],
  "Reset location": [
    "Сбросить расположение"
  ],
  "Change location": [
    "Изменить расположение"
  ],
  "Delete": [
    "Удалить"
  ],
  "Mount point": [
    "Точка монтирования"
  ],
  "Location": [
    "Расположение"
  ],
  "Table with mount points": [
    "Таблица с точками монтирования"
  ],
  "Add file system": [
    "Добавить файловую систему"
  ],
  "Other": [
    "Другая"
  ],
  "Reset to defaults": [
    "Сбросить по умолчанию"
  ],
  "Partitions and file systems": [
    "Разделы и файловые системы"
  ],
  "Structure of the new system, including any additional partition needed for booting": [
    "Структура новой системы, включая все дополнительные разделы, необходимые для загрузки"
  ],
  "Show partitions and file-systems actions": [
    "Показать разделы и действия с файловыми системами"
  ],
  "Hide %d subvolume action": [
    "Скрыть %d действие подтома",
    "Скрыть %d действия подтома",
    "Скрыть %d действий подтома"
  ],
  "Show %d subvolume action": [
    "Показать %d действие подтома",
    "Показать %d действия подтома",
    "Показать %d действий подтома"
  ],
  "Destructive actions are not allowed": [
    "Разрушительные действия запрещены"
  ],
  "Destructive actions are allowed": [
    "Разрушительные действия разрешены"
  ],
  "affecting": [
    "влияя на"
  ],
  "Shrinking partitions is not allowed": [
    "Сокращение разделов запрещено"
  ],
  "Shrinking partitions is allowed": [
    "Сокращение разделов разрешено"
  ],
  "Shrinking some partitions is allowed but not needed": [
    "Сокращение некоторых разделов разрешено, но не нужно"
  ],
  "%d partition will be shrunk": [
    "%d раздел будет сокращён",
    "%d раздела будут сокращены",
    "%d разделов будут сокращены"
  ],
  "Cannot accommodate the required file systems for installation": [
    "Невозможно разместить необходимые файловые системы для установки"
  ],
  "Check the planned action": [
    "Проверить %d запланированное действие",
    "Проверить %d запланированных действия",
    "Проверить %d запланированных действий"
  ],
  "Waiting for actions information...": [
    "Ожидание информации о действиях..."
  ],
  "Planned Actions": [
    "Планируемые действия"
  ],
  "Waiting for information about storage configuration": [
    "Ожидание информации о конфигурации хранилища"
  ],
  "Final layout": [
    "Окончательный вариант"
  ],
  "The systems will be configured as displayed below.": [
    "Системы будут настроены, как показано ниже."
  ],
  "Storage proposal not possible": [
    "Не могу предложить организацию хранилища"
  ],
  "New": [
    "Новый"
  ],
  "Before %s": [
    "До %s"
  ],
  "Mount Point": [
    "Точка монтирования"
  ],
  "Transactional root file system": [
    "Транзакционная корневая файловая система"
  ],
  "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
    "%s - это неизменяемая система с атомарными обновлениями. Она использует файловую систему Btrfs, доступную только для чтения и обновляемую с помощью моментальных снимков."
  ],
  "Use Btrfs snapshots for the root file system": [
    "Используйте моментальные снимки Btrfs для корневой файловой системы"
  ],
  "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
    "Позволяет загрузиться в предыдущую версию системы после изменения конфигурации или обновления программного обеспечения."
  ],
  "Up to %s can be recovered by shrinking the device.": [
    "До %s можно освободить, сократив устройство."
  ],
  "The device cannot be shrunk:": [
    "Устройство не может быть сокращено:"
  ],
  "Show information about %s": [
    "Показать сведения о %s"
  ],
  "The content may be deleted": [
    "Содержимое может быть удалено"
  ],
  "Action": [
    "Действие"
  ],
  "Actions to find space": [
    "Действия по поиску места"
  ],
  "Space policy": [
    "Политика пространства"
  ],
  "Add %s file system": [
    "Добавить файловую систему %s"
  ],
  "Edit %s file system": [
    "Изменить файловую систему %s"
  ],
  "Edit file system": [
    "Изменить файловую систему"
  ],
  "The type and size of the file system cannot be edited.": [
    "Тип и размер файловой системы редактировать нельзя."
  ],
  "The current file system on %s is selected to be mounted at %s.": [
    "Текущая файловая система на %s выбрана для монтирования в %s."
  ],
  "The size of the file system cannot be edited": [
    "Размер файловой системы не может быть изменен"
  ],
  "The file system is allocated at the device %s.": [
    "Файловая система выделена на устройстве %s."
  ],
  "A mount point is required": [
    "Требуется точка монтирования"
  ],
  "The mount point is invalid": [
    "Точка монтирования недопустима"
  ],
  "A size value is required": [
    "Требуется значение размера"
  ],
  "Minimum size is required": [
    "Требуется минимальный размер"
  ],
  "There is already a file system for %s.": [
    "Для %s уже существует файловая система."
  ],
  "Do you want to edit it?": [
    "Вы хотите изменить её?"
  ],
  "There is a predefined file system for %s.": [
    "Существует предопределенная файловая система для %s."
  ],
  "Do you want to add it?": [
    "Вы хотите добавить её?"
  ],
  "The options for the file system type depends on the product and the mount point.": [
    "Параметры типа файловой системы зависят от продукта и точки монтирования."
  ],
  "More info for file system types": [
    "Дополнительная информация о типах файловых систем"
  ],
  "File system type": [
    "Тип файловой системы"
  ],
  "the configuration of snapshots": [
    "конфигурация моментальных снимков"
  ],
  "the presence of the file system for %s": [
    "наличие файловой системы для %s"
  ],
  ", ": [
    ", "
  ],
  "the amount of RAM in the system": [
    "объем ОЗУ в системе"
  ],
  "The final size depends on %s.": [
    "Итоговый размер зависит от %s."
  ],
  " and ": [
    " и "
  ],
  "Automatically calculated size according to the selected product.": [
    "Автоматический расчет размера в соответствии с выбранным продуктом."
  ],
  "Exact size for the file system.": [
    "Точный размер файловой системы."
  ],
  "Exact size": [
    "Точный размер"
  ],
  "Size unit": [
    "Единица измерения"
  ],
  "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
    "Ограничения на размер файловой системы. Конечный размер будет равен значению между заданным минимумом и максимумом. Если максимальное значение не задано, то файловая система будет такой большой, на сколько это возможно."
  ],
  "Minimum": [
    "Минимум"
  ],
  "Minimum desired size": [
    "Минимальный желаемый размер"
  ],
  "Unit for the minimum size": [
    "Единица для минимального размера"
  ],
  "Maximum": [
    "Максимум"
  ],
  "Maximum desired size": [
    "Максимальный желаемый размер"
  ],
  "Unit for the maximum size": [
    "Единица для максимального размера"
  ],
  "Auto": [
    "Автоматически"
  ],
  "Fixed": [
    "Фиксированный"
  ],
  "Range": [
    "Диапазон"
  ],
  "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
    "По умолчанию файловые системы распределяются на устройстве установки. Укажите пользовательское расположение, чтобы создать файловую систему на конкретном устройстве."
  ],
  "Location for %s file system": [
    "Расположение файловой системы %s"
  ],
  "Select in which device to allocate the file system": [
    "Выберите, на каком устройстве разместить файловую систему"
  ],
  "Select a location": [
    "Выберите расположение"
  ],
  "Select how to allocate the file system": [
    "Выберите способ выделения файловой системы"
  ],
  "Create a new partition": [
    "Создать новый раздел"
  ],
  "The file system will be allocated as a new partition at the selected   disk.": [
    "Файловая система будет выделена в качестве нового раздела на выбранном   диске."
  ],
  "Create a dedicated LVM volume group": [
    "Создать выделенную группу томов LVM"
  ],
  "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
    "На выбранном диске будет выделена новая группа томов, а   файловая система будет создана как логический том."
  ],
  "Format the device": [
    "Отформатировать устройство"
  ],
  "The selected device will be formatted as %s file system.": [
    "Выбранное устройство будет отформатировано в файловую систему %s."
  ],
  "Mount the file system": [
    "Смонтировать файловую систему"
  ],
  "The current file system on the selected device will be mounted   without formatting the device.": [
    "Текущая файловая система на выбранном устройстве будет смонтирована   без форматирования устройства."
  ],
  "Usage": [
    "Использование"
  ],
  "Formatting DASD devices": [
    "Форматирование устройств DASD"
  ],
  "No": [
    "Нет"
  ],
  "Yes": [
    "Да"
  ],
  "Channel ID": [
    "Идентификатор канала"
  ],
  "Status": [
    "Состояние"
  ],
  "Type": [
    "Тип"
  ],
  "DIAG": [
    "Режим DIAG"
  ],
  "Formatted": [
    "Отформатированный"
  ],
  "Partition Info": [
    "Информация о разделе"
  ],
  "Cannot format all selected devices": [
    ""
  ],
  "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
    ""
  ],
  "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
    ""
  ],
  "Perform an action": [
    "Выполнить действие"
  ],
  "Activate": [
    "Активировать"
  ],
  "Deactivate": [
    "Деактивировать"
  ],
  "Set DIAG On": [
    "Включить DIAG"
  ],
  "Set DIAG Off": [
    "Отключить DIAG"
  ],
  "Format": [
    "Формат"
  ],
  "Filter by min channel": [
    "Фильтр по минимальному каналу"
  ],
  "Remove min channel filter": [
    "Удалить фильтр по минимальному каналу"
  ],
  "Filter by max channel": [
    "Фильтр по максимальному каналу"
  ],
  "Remove max channel filter": [
    "Удалить фильтр по максимальному каналу"
  ],
  "Unused space": [
    "Неиспользуемое пространство"
  ],
  "Only available if authentication by target is provided": [
    "Доступно только при условии аутентификации по цели"
  ],
  "Authentication by target": [
    "Аутентификация по цели"
  ],
  "User name": [
    "Имя пользователя"
  ],
  "Incorrect user name": [
    "Некорректное имя пользователя"
  ],
  "Incorrect password": [
    "Некорректный пароль"
  ],
  "Authentication by initiator": [
    "Аутентификация инициатором"
  ],
  "Target Password": [
    "Пароль цели"
  ],
  "Discover iSCSI Targets": [
    "Знакомство с целевыми устройствами iSCSI"
  ],
  "Make sure you provide the correct values": [
    "Убедитесь, что вы указали правильные значения"
  ],
  "IP address": [
    "IP-адрес"
  ],
  "Address": [
    "Адрес"
  ],
  "Incorrect IP address": [
    "Некорректный IP-адрес"
  ],
  "Port": [
    "Порт"
  ],
  "Incorrect port": [
    "Некорректный порт"
  ],
  "Edit %s": [
    "Изменить %s"
  ],
  "Edit iSCSI Initiator": [
    "Изменить инициатор iSCSI"
  ],
  "Initiator name": [
    "Имя инициатора"
  ],
  "iBFT": [
    "iBFT"
  ],
  "Offload card": [
    "Разгрузочная карта"
  ],
  "Initiator": [
    "Инициатор"
  ],
  "Login %s": [
    "Логин %s"
  ],
  "Startup": [
    "Запуск"
  ],
  "On boot": [
    "При загрузке"
  ],
  "Connected (%s)": [
    "Подключено (%s)"
  ],
  "Login": [
    "Вход"
  ],
  "Logout": [
    "Выход"
  ],
  "Portal": [
    "Портал"
  ],
  "Interface": [
    "Интерфейс"
  ],
  "No iSCSI targets found.": [
    "Цели iSCSI не найдены."
  ],
  "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
    "Выполните обнаружение iSCSI, чтобы найти доступные цели iSCSI."
  ],
  "Discover iSCSI targets": [
    "Обнаружение целей iSCSI"
  ],
  "Discover": [
    "Обнаружить"
  ],
  "Targets": [
    "Цели"
  ],
  "KiB": [
    "КиБ"
  ],
  "MiB": [
    "МиБ"
  ],
  "GiB": [
    "ГиБ"
  ],
  "TiB": [
    "ТиБ"
  ],
  "PiB": [
    "ПиБ"
  ],
  "Delete current content": [
    "Удалить текущее содержимое"
  ],
  "All partitions will be removed and any data in the disks will be lost.": [
    "Все разделы будут удалены, а все данные на дисках будут потеряны."
  ],
  "deleting current content": [
    "удаление текущего содержимого"
  ],
  "Shrink existing partitions": [
    "Уменьшение существующих разделов"
  ],
  "The data is kept, but the current partitions will be resized as needed.": [
    "Данные сохраняются, но размер текущих разделов будет изменен по мере необходимости."
  ],
  "shrinking partitions": [
    "уменьшение разделов"
  ],
  "Use available space": [
    "Использовать свободное пространство"
  ],
  "The data is kept. Only the space not assigned to any partition will be used.": [
    "Данные сохраняются. Будет использовано только пространство, не отведенное для какого-либо раздела."
  ],
  "without modifying any partition": [
    "не изменяя ни одного раздела"
  ],
  "Custom": [
    "По-своему"
  ],
  "Select what to do with each partition.": [
    "Выберите, что делать с каждым разделом."
  ],
  "with custom actions": [
    "другими способами"
  ],
  "Auto LUNs Scan": [
    "Автоматическое сканирование LUN"
  ],
  "Activated": [
    "Активировано"
  ],
  "Deactivated": [
    "Деактивировано"
  ],
  "zFCP Disk Activation": [
    ""
  ],
  "zFCP Disk activation form": [
    ""
  ],
  "The zFCP disk was not activated.": [
    "Диск zFCP не был активирован."
  ],
  "WWPN": [
    "WWPN"
  ],
  "LUN": [
    "LUN"
  ],
  "Please, try to activate a zFCP disk.": [
    "Пожалуйста, попробуйте активировать диск zFCP."
  ],
  "Please, try to activate a zFCP controller.": [
    "Пожалуйста, попробуйте активировать контроллер zFCP."
  ],
  "No zFCP disks found.": [
    "Диски zFCP не найдены."
  ],
  "Activate zFCP disk": [
    "Активировать диск zFCP"
  ],
  "Activate new disk": [
    "Активировать новый диск"
  ],
  "Disks": [
    "Диски"
  ],
  "Controllers": [
    ""
  ],
  "No zFCP controllers found.": [
    "Контроллеры zFCP не найдены."
  ],
  "Read zFCP devices": [
    "Прочитать устройства zFCP"
  ],
  "Define a user now": [
    "Определить пользователя"
  ],
  "No user defined yet.": [
    "Пользователь еще не определен."
  ],
  "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
    "Обратите внимание, что перед установкой системы необходимо определить пользователя, чтобы он мог войти в систему."
  ],
  "Full name": [
    "Полное имя"
  ],
  "Username": [
    "Имя пользователя"
  ],
  "Discard": [
    "Отказаться"
  ],
  "First user": [
    "Первый пользователь"
  ],
  "Username suggestion dropdown": [
    "Выпадающий список с предложением имени пользователя"
  ],
  "Use suggested username": [
    "Используйте предложенное имя пользователя"
  ],
  "All fields are required": [
    "Все поля обязательны"
  ],
  "Create user": [
    "Создать пользователя"
  ],
  "Edit user": [
    "Изменить пользователя"
  ],
  "User full name": [
    "Полное имя пользователя"
  ],
  "Edit password too": [
    "Также изменить пароль"
  ],
  "user autologin": [
    "автоматический вход пользователя"
  ],
  "Auto-login": [
    "Автологин"
  ],
  "No root authentication method defined yet.": [
    "Метод корневой аутентификации пока не определен."
  ],
  "Please, define at least one authentication method for logging into the system as root.": [
    "Пожалуйста, определите хотя бы один метод аутентификации для входа в систему с правами root."
  ],
  "Method": [
    "Метод"
  ],
  "Already set": [
    "Уже установлен"
  ],
  "Not set": [
    "Не установлен"
  ],
  "SSH Key": [
    "Ключ SSH"
  ],
  "Set": [
    "Установить"
  ],
  "Root authentication": [
    "Аутентификация root"
  ],
  "Set a password": [
    "Установить пароль"
  ],
  "Upload a SSH Public Key": [
    "Загрузить публичный ключ SSH"
  ],
  "Change the root password": [
    "Изменить пароль root"
  ],
  "Set a root password": [
    "Установить пароль root"
  ],
  "Edit the SSH Public Key for root": [
    "Изменить публичный ключ SSH для root"
  ],
  "Add a SSH Public Key for root": [
    "Добавить публичный ключ SSH для root"
  ],
  "Root password": [
    "Пароль root"
  ],
  "Set root SSH public key": [
    "Установить публичный ключ SSH для root"
  ],
  "Root SSH public key": [
    "Публичный ключ SSH для root"
  ],
  "Upload, paste, or drop an SSH public key": [
    "Загрузите, вставьте или сбросьте публичный ключ SSH"
  ],
  "Upload": [
    "Загрузить"
  ],
  "Clear": [
    "Очистить"
  ],
  "ZFCP": [
    ""
  ]
});
