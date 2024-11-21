import agama from "../agama";

agama.locale({
 "": {
  "plural-forms": (n) => n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2,
  "language": "ru"
 },
 "Change product": [
  null,
  "Изменить продукт"
 ],
 "Confirm Installation": [
  null,
  "Подтвердить установку"
 ],
 "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
  null,
  "Если вы продолжите, разделы на вашем жестком диске будут изменены в соответствии с заданными настройками установки."
 ],
 "Please, cancel and check the settings if you are unsure.": [
  null,
  "Пожалуйста, отмените и проверьте настройки, если вы не уверены."
 ],
 "Continue": [
  null,
  "Продолжить"
 ],
 "Cancel": [
  null,
  "Отмена"
 ],
 "Install": [
  null,
  "Установить"
 ],
 "TPM sealing requires the new system to be booted directly.": [
  null,
  "Запечатывание TPM требует прямой загрузки новой системы."
 ],
 "If a local media was used to run this installer, remove it before the next boot.": [
  null,
  "Если для запуска этой программы установки использовался локальный носитель, извлеките его перед следующей загрузкой."
 ],
 "Hide details": [
  null,
  "Скрыть подробности"
 ],
 "See more details": [
  null,
  "См. подробнее"
 ],
 "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
  null,
  "Последний шаг по настройке Доверенного платформенного модуля (TPM) на автоматическое открытие зашифрованных устройств будет выполнен во время первой загрузки новой системы. Чтобы это сработало, машина должна загрузиться непосредственно в новый загрузчик."
 ],
 "Congratulations!": [
  null,
  "Поздравляем!"
 ],
 "The installation on your machine is complete.": [
  null,
  "Установка на ваш компьютер завершена."
 ],
 "At this point you can power off the machine.": [
  null,
  "На этом этапе вы можете выключить устройство."
 ],
 "At this point you can reboot the machine to log in to the new system.": [
  null,
  "На этом этапе вы можете перезагрузить устройство, чтобы войти в новую систему."
 ],
 "Finish": [
  null,
  "Завершить"
 ],
 "Reboot": [
  null,
  "Перезагрузка"
 ],
 "Installer options": [
  null,
  "Параметры установщика"
 ],
 "Language": [
  null,
  "Язык"
 ],
 "Keyboard layout": [
  null,
  "Раскладка клавиатуры"
 ],
 "Cannot be changed in remote installation": [
  null,
  "Нельзя изменить при удаленной установке"
 ],
 "Accept": [
  null,
  "Подтвердить"
 ],
 "Before starting the installation, you need to address the following problems:": [
  null,
  "До начала установки нужно устранить следующие проблемы:"
 ],
 "Installation not possible yet because of issues. Check them at Overview page.": [
  null,
  ""
 ],
 "Search": [
  null,
  "Поиск"
 ],
 "Could not log in. Please, make sure that the password is correct.": [
  null,
  "Не удалось войти в систему. Пожалуйста, убедитесь, что пароль введен правильно."
 ],
 "Could not authenticate against the server, please check it.": [
  null,
  "Не удалось пройти аутентификацию на сервере, пожалуйста, проверьте его."
 ],
 "Log in as %s": [
  null,
  "Вход как %s"
 ],
 "The installer requires [root] user privileges.": [
  null,
  "Программа установки требует привилегий пользователя [root]."
 ],
 "Please, provide its password to log in to the system.": [
  null,
  "Пожалуйста, укажите его пароль для входа в систему."
 ],
 "Login form": [
  null,
  "Форма входа"
 ],
 "Password input": [
  null,
  "Ввод пароля"
 ],
 "Log in": [
  null,
  "Вход"
 ],
 "Back": [
  null,
  "Назад"
 ],
 "Passwords do not match": [
  null,
  "Пароли не совпадают"
 ],
 "Password": [
  null,
  "Пароль"
 ],
 "Password confirmation": [
  null,
  "Подтверждение пароля"
 ],
 "Password visibility button": [
  null,
  "Кнопка отображения пароля"
 ],
 "Confirm": [
  null,
  "Подтвердить"
 ],
 "Loading data...": [
  null,
  "Загрузка данных..."
 ],
 "Pending": [
  null,
  "Ожидается"
 ],
 "In progress": [
  null,
  "В процессе"
 ],
 "Finished": [
  null,
  "Завершено"
 ],
 "Actions": [
  null,
  "Действия"
 ],
 "Waiting": [
  null,
  "Ожидание"
 ],
 "Cannot connect to Agama server": [
  null,
  "Не удалось подключиться к серверу Agama"
 ],
 "Please, check whether it is running.": [
  null,
  "Пожалуйста, проверьте, запущен ли он."
 ],
 "Reload": [
  null,
  "Обновить"
 ],
 "Filter by description or keymap code": [
  null,
  "Фильтр по описанию или коду карты клавиш"
 ],
 "None of the keymaps match the filter.": [
  null,
  "Ни одна из карт не соответствует фильтру."
 ],
 "Keyboard selection": [
  null,
  "Выбор клавиатуры"
 ],
 "Select": [
  null,
  "Выбор"
 ],
 "Localization": [
  null,
  "Локализация"
 ],
 "Not selected yet": [
  null,
  "Ещё не выбрано"
 ],
 "Change": [
  null,
  "Изменить"
 ],
 "Keyboard": [
  null,
  "Клавиатура"
 ],
 "Time zone": [
  null,
  "Часовой пояс"
 ],
 "Filter by language, territory or locale code": [
  null,
  "Фильтр по языку, территории или коду локали"
 ],
 "None of the locales match the filter.": [
  null,
  "Ни одна из локалей не соответствует фильтру."
 ],
 "Locale selection": [
  null,
  "Выбор локали"
 ],
 "Filter by territory, time zone code or UTC offset": [
  null,
  "Фильтр по территории, коду часового пояса или смещению UTC"
 ],
 "None of the time zones match the filter.": [
  null,
  "Ни один из часовых поясов не соответствует фильтру."
 ],
 " Timezone selection": [
  null,
  " Выбор часового пояса"
 ],
 "Download logs": [
  null,
  "Скачать журналы"
 ],
 "Main navigation": [
  null,
  ""
 ],
 "Loading installation environment, please wait.": [
  null,
  "Загрузка установочной среды, пожалуйста, подождите."
 ],
 "Remove": [
  null,
  "Удалить"
 ],
 "IP Address": [
  null,
  "IP-адрес"
 ],
 "Prefix length or netmask": [
  null,
  "Длина префикса или маска сети"
 ],
 "Add an address": [
  null,
  "Добавить адрес"
 ],
 "Add another address": [
  null,
  "Добавить другой адрес"
 ],
 "Addresses": [
  null,
  "Адреса"
 ],
 "Addresses data list": [
  null,
  "Список данных адресов"
 ],
 "Name": [
  null,
  "Имя"
 ],
 "IP addresses": [
  null,
  "IP-адреса"
 ],
 "Connection actions": [
  null,
  "Действия подключения"
 ],
 "Edit": [
  null,
  "Изменить"
 ],
 "Edit connection %s": [
  null,
  "Отредактировать соединение %s"
 ],
 "Forget": [
  null,
  "Забыть"
 ],
 "Forget connection %s": [
  null,
  "Забыть соединение %s"
 ],
 "Actions for connection %s": [
  null,
  "Действия для соединения %s"
 ],
 "Server IP": [
  null,
  "IP сервера"
 ],
 "Add DNS": [
  null,
  "Добавить DNS"
 ],
 "Add another DNS": [
  null,
  "Добавить другой DNS"
 ],
 "DNS": [
  null,
  "DNS"
 ],
 "At least one address must be provided for selected mode": [
  null,
  "Для выбранного режима необходимо предоставить не менее одного адреса"
 ],
 "Mode": [
  null,
  "Режим"
 ],
 "Automatic (DHCP)": [
  null,
  "Автоматически (DHCP)"
 ],
 "Manual": [
  null,
  "Вручную"
 ],
 "Gateway": [
  null,
  "Шлюз"
 ],
 "Gateway can be defined only in 'Manual' mode": [
  null,
  "Шлюз можно указать только в ручном режиме"
 ],
 "Wired": [
  null,
  "Проводное"
 ],
 "No wired connections found": [
  null,
  "Проводные соединения не обнаружены"
 ],
 "Wi-Fi": [
  null,
  "Wi-Fi"
 ],
 "Connect": [
  null,
  "Подключиться"
 ],
 "No connected yet": [
  null,
  "Ещё не подключено"
 ],
 "The system has not been configured for connecting to a Wi-Fi network yet.": [
  null,
  "Система ещё не настроена на подключение к сети Wi-Fi."
 ],
 "No Wi-Fi supported": [
  null,
  "Нет поддержки Wi-Fi"
 ],
 "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
  null,
  "Система не поддерживает соединение по WiFi, вероятно, из-за отсутствующего или отключённого оборудования."
 ],
 "Network": [
  null,
  "Сеть"
 ],
 "None": [
  null,
  "Отсутствует"
 ],
 "WPA & WPA2 Personal": [
  null,
  "WPA и WPA2 Personal"
 ],
 "Something went wrong": [
  null,
  "Что-то пошло не так"
 ],
 "Please, review provided settings and try again.": [
  null,
  "Пожалуйста, проверьте предоставленные настройки и попробуйте ещё раз."
 ],
 "SSID": [
  null,
  "Имя сети"
 ],
 "Security": [
  null,
  "Защита"
 ],
 "WPA Password": [
  null,
  "Пароль WPA"
 ],
 "Connecting": [
  null,
  "Подключение"
 ],
 "Connected": [
  null,
  "Подключено"
 ],
 "Disconnected": [
  null,
  "Отключено"
 ],
 "Disconnect": [
  null,
  "Отключить"
 ],
 "Connect to hidden network": [
  null,
  "Подключиться к скрытой сети"
 ],
 "configured": [
  null,
  "настроено"
 ],
 "Connect to a Wi-Fi network": [
  null,
  "Подключиться к сети Wi-Fi"
 ],
 "The system will use %s as its default language.": [
  null,
  "Система будет использовать %s в качестве языка по умолчанию."
 ],
 "Users": [
  null,
  "Пользователи"
 ],
 "Storage": [
  null,
  "Хранилище"
 ],
 "Software": [
  null,
  "Программы"
 ],
 "Before installing, please check the following problems.": [
  null,
  "Проверьте следующие проблемы перед установкой."
 ],
 "Overview": [
  null,
  "Обзор"
 ],
 "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
  null,
  "Это наиболее актуальные настройки установки. Более подробные сведения приведены в разделах меню."
 ],
 "Take your time to check your configuration before starting the installation process.": [
  null,
  "Проверьте свои настройки до начала процесса установки."
 ],
 "The installation will take": [
  null,
  "Установка займёт"
 ],
 "The installation will take %s including:": [
  null,
  "Установка займёт %s, в том числе:"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
  null,
  "Установите новую группу томов Logical Volume Manager (LVM), уменьшив при необходимости существующие разделы на базовых устройствах"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) без изменения разделов на базовых устройствах"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) с удалением всего содержимого базовых устройств"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) с использованием пользовательской стратегии для поиска необходимого пространства на базовых устройствах"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) на %s, уменьшив существующие разделы по мере необходимости"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) на %s без изменения существующих разделов"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) на %s, удалив все её содержимое"
 ],
 "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
  null,
  "Установка в новую группу томов Logical Volume Manager (LVM) на %s с использованием пользовательской стратегии для поиска необходимого пространства"
 ],
 "No device selected yet": [
  null,
  "Устройство ещё не выбрано"
 ],
 "Install using device %s shrinking existing partitions as needed": [
  null,
  "Установка с использованием устройства %s с уменьшением существующих разделов по мере необходимости"
 ],
 "Install using device %s without modifying existing partitions": [
  null,
  "Установка с использованием устройства %s без изменения существующих разделов"
 ],
 "Install using device %s and deleting all its content": [
  null,
  "Установить с использованием устройства %s и удалить все его содержимое"
 ],
 "Install using device %s with a custom strategy to find the needed space": [
  null,
  "Установка с использованием устройства %s с помощью пользовательской стратегии поиска необходимого пространства"
 ],
 "%s logo": [
  null,
  ""
 ],
 "Available products": [
  null,
  "Доступные продукты"
 ],
 "Configuring the product, please wait ...": [
  null,
  "Настройка продукта, пожалуйста, подождите..."
 ],
 "Question": [
  null,
  "Вопрос"
 ],
 "Encrypted Device": [
  null,
  "Зашифрованное устройство"
 ],
 "Encryption Password": [
  null,
  "Пароль шифрования"
 ],
 "Password Required": [
  null,
  "Необходим пароль"
 ],
 "No additional software was selected.": [
  null,
  "Никакого дополнительного программного обеспечения выбрано не было."
 ],
 "The following software patterns are selected for installation:": [
  null,
  "Для установки выбраны следующие образцы программного обеспечения:"
 ],
 "Selected patterns": [
  null,
  "Выбранные шаблоны"
 ],
 "Change selection": [
  null,
  "Изменить выбор"
 ],
 "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
  null,
  "Данный продукт не позволяет выбирать шаблоны программного обеспечения во время установки. Однако Вы можете добавить дополнительное программное обеспечение после завершения установки."
 ],
 "None of the patterns match the filter.": [
  null,
  "Ни один из шаблонов не соответствует фильтру."
 ],
 "auto selected": [
  null,
  "автоматический выбор"
 ],
 "Software selection": [
  null,
  "Выбор программного обеспечения"
 ],
 "Filter by pattern title or description": [
  null,
  "Фильтр по названию или описанию шаблона"
 ],
 "Close": [
  null,
  "Закрыть"
 ],
 "Installation will take %s.": [
  null,
  "Установка займёт %s."
 ],
 "This space includes the base system and the selected software patterns, if any.": [
  null,
  "Это пространство включает в себя базовую систему и выбранные шаблоны программного обеспечения, если таковые имеются."
 ],
 "Change boot options": [
  null,
  "Изменение параметров загрузки"
 ],
 "Installation will not configure partitions for booting.": [
  null,
  "Установка не будет настраивать разделы для загрузки."
 ],
 "Installation will configure partitions for booting at the installation disk.": [
  null,
  "Установка настроит разделы для загрузки с установочного диска."
 ],
 "Installation will configure partitions for booting at %s.": [
  null,
  "Установка настроит разделы для загрузки по адресу %s."
 ],
 "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
  null,
  "Чтобы обеспечить загрузку новой системы, программе установки может потребоваться создать или настроить некоторые разделы на соответствующем диске."
 ],
 "Partitions to boot will be allocated at the installation disk.": [
  null,
  "Загрузочные разделы будут выделены на установочном диске."
 ],
 "Partitions to boot will be allocated at the installation disk (%s).": [
  null,
  "Загрузочные разделы будут выделены на установочном диске (%s)."
 ],
 "Select booting partition": [
  null,
  "Выберите загрузочный раздел"
 ],
 "Automatic": [
  null,
  "Автоматически"
 ],
 "Select a disk": [
  null,
  "Выберите диск"
 ],
 "Partitions to boot will be allocated at the following device.": [
  null,
  "Загрузочные разделы будут выделены на следующем устройстве."
 ],
 "Choose a disk for placing the boot loader": [
  null,
  "Выберите диск для размещения загрузчика"
 ],
 "Do not configure": [
  null,
  "Не настраивать"
 ],
 "No partitions will be automatically configured for booting. Use with caution.": [
  null,
  "Ни один раздел не будет автоматически настроен для загрузки. Используйте с осторожностью."
 ],
 "The file systems will be allocated by default as [new partitions in the selected device].": [
  null,
  "Файловые системы будут выделены по умолчанию как [новые разделы на выбранном устройстве]."
 ],
 "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
  null,
  "Файловые системы по умолчанию будут выделены как [логические тома новой группы томов LVM]. Соответствующие физические тома будут создаваться по требованию как новые разделы на выбранных устройствах."
 ],
 "Select installation device": [
  null,
  "Выберите устройство для установки"
 ],
 "Install new system on": [
  null,
  "Установить новую систему на"
 ],
 "An existing disk": [
  null,
  "существующий диск"
 ],
 "A new LVM Volume Group": [
  null,
  "новую группу томов LVM"
 ],
 "Device selector for target disk": [
  null,
  "Выбор устройств для целевого диска"
 ],
 "Device selector for new LVM volume group": [
  null,
  "Выбор устройств для новой группы томов LVM"
 ],
 "Prepare more devices by configuring advanced": [
  null,
  "Подготовьте больше устройств, настроив расширенные"
 ],
 "storage techs": [
  null,
  "технологии хранения"
 ],
 "Multipath": [
  null,
  "Многопутевое"
 ],
 "DASD %s": [
  null,
  "DASD %s"
 ],
 "Software %s": [
  null,
  "Программное обеспечение %s"
 ],
 "SD Card": [
  null,
  "SD-карта"
 ],
 "%s disk": [
  null,
  "Диск %s"
 ],
 "Disk": [
  null,
  "Диск"
 ],
 "Members: %s": [
  null,
  "Участники: %s"
 ],
 "Devices: %s": [
  null,
  "Устройства: %s"
 ],
 "Wires: %s": [
  null,
  "Проводки: %s"
 ],
 "%s with %d partitions": [
  null,
  "%s с %d разделами"
 ],
 "No content found": [
  null,
  "Содержимое не найдено"
 ],
 "Device": [
  null,
  "Устройство"
 ],
 "Details": [
  null,
  "Подробности"
 ],
 "Size": [
  null,
  "Размер"
 ],
 "Manage and format": [
  null,
  "Управление и форматирование"
 ],
 "Activate disks": [
  null,
  "Активировать диски"
 ],
 "zFCP": [
  null,
  "zFCP"
 ],
 "Connect to iSCSI targets": [
  null,
  "Подключение к объектам iSCSI"
 ],
 "iSCSI": [
  null,
  "iSCSI"
 ],
 "disabled": [
  null,
  "отключено"
 ],
 "enabled": [
  null,
  "включено"
 ],
 "using TPM unlocking": [
  null,
  "используя разблокировку TPM"
 ],
 "Enable": [
  null,
  "Включить"
 ],
 "Modify": [
  null,
  "Изменить"
 ],
 "Encryption": [
  null,
  "Шифрование"
 ],
 "Protection for the information stored at the device, including data, programs, and system files.": [
  null,
  "Защита информации, хранящейся на устройстве, включая данные, программы и системные файлы."
 ],
 "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
  null,
  "Используйте Доверенный платформенный модуль (TPM) для автоматического дешифрования при каждой загрузке"
 ],
 "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
  null,
  "Пароль не понадобится для загрузки и доступа к данным, если TPM может проверить целостность системы. Запечатывание TPM требует непосредственной загрузки новой системы при первом запуске."
 ],
 "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
  null,
  "Полнодисковое шифрование (FDE) позволяет защитить информацию, хранящуюся на устройстве, включая данные, программы и системные файлы."
 ],
 "Encrypt the system": [
  null,
  "Зашифровать систему"
 ],
 "File systems created as new partitions at %s": [
  null,
  "Файловые системы созданы как новые разделы на %s"
 ],
 "File systems created at a new LVM volume group": [
  null,
  "Файловые системы созданы в новой группе томов LVM"
 ],
 "File systems created at a new LVM volume group on %s": [
  null,
  "Файловые системы созданы в новой группе томов LVM на %s"
 ],
 "Main disk or LVM Volume Group for installation.": [
  null,
  "Основной диск или группа томов LVM для установки."
 ],
 "Installation device": [
  null,
  "Устройство для установки"
 ],
 "Maximum must be greater than minimum": [
  null,
  "Максимум должен быть больше минимума"
 ],
 "at least %s": [
  null,
  "не менее %s"
 ],
 "Transactional Btrfs root volume (%s)": [
  null,
  "Корневой том Btrfs с транзакциями (%s)"
 ],
 "Transactional Btrfs root partition (%s)": [
  null,
  "Корневой раздел Btrfs с транзакциями (%s)"
 ],
 "Btrfs root volume with snapshots (%s)": [
  null,
  "Корневой том Btrfs с моментальными снимками (%s)"
 ],
 "Btrfs root partition with snapshots (%s)": [
  null,
  "Корневой раздел Btrfs с моментальными снимками (%s)"
 ],
 "Mount %1$s at %2$s (%3$s)": [
  null,
  "Установить %1$s в %2$s (%3$s)"
 ],
 "Swap at %1$s (%2$s)": [
  null,
  "Подкачка на %1$s (%2$s)"
 ],
 "Swap volume (%s)": [
  null,
  "Том для подкачки (%s)"
 ],
 "Swap partition (%s)": [
  null,
  "Раздел подкачки (%s)"
 ],
 "%1$s root at %2$s (%3$s)": [
  null,
  "%1$s корень на %2$s (%3$s)"
 ],
 "%1$s root volume (%2$s)": [
  null,
  "Корневой том %1$s (%2$s)"
 ],
 "%1$s root partition (%2$s)": [
  null,
  "Корневой раздел %1$s (%2$s)"
 ],
 "%1$s %2$s at %3$s (%4$s)": [
  null,
  "%1$s %2$s на %3$s (%4$s)"
 ],
 "%1$s %2$s volume (%3$s)": [
  null,
  "%1$s том %2$s (%3$s)"
 ],
 "%1$s %2$s partition (%3$s)": [
  null,
  "%1$s раздел %2$s (%3$s)"
 ],
 "Do not configure partitions for booting": [
  null,
  "Не настраивать разделы для загрузки"
 ],
 "Boot partitions at installation disk": [
  null,
  "Загрузочные разделы на диске для установки"
 ],
 "Boot partitions at %s": [
  null,
  "Загрузочные разделы на %s"
 ],
 "These limits are affected by:": [
  null,
  "На эти ограничения влияют:"
 ],
 "The configuration of snapshots": [
  null,
  "Конфигурация моментальных снимков"
 ],
 "Presence of other volumes (%s)": [
  null,
  "Наличие других томов (%s)"
 ],
 "The amount of RAM in the system": [
  null,
  "Объем ОЗУ в системе"
 ],
 "auto": [
  null,
  "автоматически"
 ],
 "Reused %s": [
  null,
  "Повторно используется %s"
 ],
 "Transactional Btrfs": [
  null,
  "Транзакционная Btrfs"
 ],
 "Btrfs with snapshots": [
  null,
  "Btrfs с моментальными снимками"
 ],
 "Partition at %s": [
  null,
  "Раздел на %s"
 ],
 "Separate LVM at %s": [
  null,
  "Отдельный LVM на %s"
 ],
 "Logical volume at system LVM": [
  null,
  "Логический том в системе LVM"
 ],
 "Partition at installation disk": [
  null,
  "Раздел на диске для установки"
 ],
 "Reset location": [
  null,
  "Сбросить расположение"
 ],
 "Change location": [
  null,
  "Изменить расположение"
 ],
 "Delete": [
  null,
  "Удалить"
 ],
 "Mount point": [
  null,
  "Точка монтирования"
 ],
 "Location": [
  null,
  "Расположение"
 ],
 "Table with mount points": [
  null,
  "Таблица с точками монтирования"
 ],
 "Add file system": [
  null,
  "Добавить файловую систему"
 ],
 "Other": [
  null,
  "Другая"
 ],
 "Reset to defaults": [
  null,
  "Сбросить по умолчанию"
 ],
 "Partitions and file systems": [
  null,
  "Разделы и файловые системы"
 ],
 "Structure of the new system, including any additional partition needed for booting": [
  null,
  "Структура новой системы, включая все дополнительные разделы, необходимые для загрузки"
 ],
 "Show partitions and file-systems actions": [
  null,
  "Показать разделы и действия с файловыми системами"
 ],
 "Hide %d subvolume action": [
  null,
  "Скрыть %d действие подтома",
  "Скрыть %d действия подтома",
  "Скрыть %d действий подтома"
 ],
 "Show %d subvolume action": [
  null,
  "Показать %d действие подтома",
  "Показать %d действия подтома",
  "Показать %d действий подтома"
 ],
 "Destructive actions are not allowed": [
  null,
  "Разрушительные действия запрещены"
 ],
 "Destructive actions are allowed": [
  null,
  "Разрушительные действия разрешены"
 ],
 "affecting": [
  null,
  "влияя на"
 ],
 "Shrinking partitions is not allowed": [
  null,
  "Сокращение разделов запрещено"
 ],
 "Shrinking partitions is allowed": [
  null,
  "Сокращение разделов разрешено"
 ],
 "Shrinking some partitions is allowed but not needed": [
  null,
  "Сокращение некоторых разделов разрешено, но не нужно"
 ],
 "%d partition will be shrunk": [
  null,
  "%d раздел будет сокращён",
  "%d раздела будут сокращены",
  "%d разделов будут сокращены"
 ],
 "Cannot accommodate the required file systems for installation": [
  null,
  "Невозможно разместить необходимые файловые системы для установки"
 ],
 "Check the planned action": [
  null,
  "Проверить %d запланированное действие",
  "Проверить %d запланированных действия",
  "Проверить %d запланированных действий"
 ],
 "Waiting for actions information...": [
  null,
  "Ожидание информации о действиях..."
 ],
 "Planned Actions": [
  null,
  "Планируемые действия"
 ],
 "Waiting for information about storage configuration": [
  null,
  "Ожидание информации о конфигурации хранилища"
 ],
 "Final layout": [
  null,
  "Окончательный вариант"
 ],
 "The systems will be configured as displayed below.": [
  null,
  "Системы будут настроены, как показано ниже."
 ],
 "Storage proposal not possible": [
  null,
  "Не могу предложить организацию хранилища"
 ],
 "New": [
  null,
  "Новый"
 ],
 "Before %s": [
  null,
  "До %s"
 ],
 "Mount Point": [
  null,
  "Точка монтирования"
 ],
 "Transactional root file system": [
  null,
  "Транзакционная корневая файловая система"
 ],
 "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
  null,
  "%s - это неизменяемая система с атомарными обновлениями. Она использует файловую систему Btrfs, доступную только для чтения и обновляемую с помощью моментальных снимков."
 ],
 "Use Btrfs snapshots for the root file system": [
  null,
  "Используйте моментальные снимки Btrfs для корневой файловой системы"
 ],
 "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
  null,
  "Позволяет загрузиться в предыдущую версию системы после изменения конфигурации или обновления программного обеспечения."
 ],
 "Up to %s can be recovered by shrinking the device.": [
  null,
  "До %s можно освободить, сократив устройство."
 ],
 "The device cannot be shrunk:": [
  null,
  "Устройство не может быть сокращено:"
 ],
 "Show information about %s": [
  null,
  "Показать сведения о %s"
 ],
 "The content may be deleted": [
  null,
  "Содержимое может быть удалено"
 ],
 "Action": [
  null,
  "Действие"
 ],
 "Actions to find space": [
  null,
  "Действия по поиску места"
 ],
 "Space policy": [
  null,
  "Политика пространства"
 ],
 "Add %s file system": [
  null,
  "Добавить файловую систему %s"
 ],
 "Edit %s file system": [
  null,
  "Изменить файловую систему %s"
 ],
 "Edit file system": [
  null,
  "Изменить файловую систему"
 ],
 "The type and size of the file system cannot be edited.": [
  null,
  "Тип и размер файловой системы редактировать нельзя."
 ],
 "The current file system on %s is selected to be mounted at %s.": [
  null,
  "Текущая файловая система на %s выбрана для монтирования в %s."
 ],
 "The size of the file system cannot be edited": [
  null,
  "Размер файловой системы не может быть изменен"
 ],
 "The file system is allocated at the device %s.": [
  null,
  "Файловая система выделена на устройстве %s."
 ],
 "A mount point is required": [
  null,
  "Требуется точка монтирования"
 ],
 "The mount point is invalid": [
  null,
  "Точка монтирования недопустима"
 ],
 "A size value is required": [
  null,
  "Требуется значение размера"
 ],
 "Minimum size is required": [
  null,
  "Требуется минимальный размер"
 ],
 "There is already a file system for %s.": [
  null,
  "Для %s уже существует файловая система."
 ],
 "Do you want to edit it?": [
  null,
  "Вы хотите изменить её?"
 ],
 "There is a predefined file system for %s.": [
  null,
  "Существует предопределенная файловая система для %s."
 ],
 "Do you want to add it?": [
  null,
  "Вы хотите добавить её?"
 ],
 "The options for the file system type depends on the product and the mount point.": [
  null,
  "Параметры типа файловой системы зависят от продукта и точки монтирования."
 ],
 "More info for file system types": [
  null,
  "Дополнительная информация о типах файловых систем"
 ],
 "File system type": [
  null,
  "Тип файловой системы"
 ],
 "the configuration of snapshots": [
  null,
  "конфигурация моментальных снимков"
 ],
 "the presence of the file system for %s": [
  null,
  "наличие файловой системы для %s"
 ],
 ", ": [
  null,
  ", "
 ],
 "the amount of RAM in the system": [
  null,
  "объем ОЗУ в системе"
 ],
 "The final size depends on %s.": [
  null,
  "Итоговый размер зависит от %s."
 ],
 " and ": [
  null,
  " и "
 ],
 "Automatically calculated size according to the selected product.": [
  null,
  "Автоматический расчет размера в соответствии с выбранным продуктом."
 ],
 "Exact size for the file system.": [
  null,
  "Точный размер файловой системы."
 ],
 "Exact size": [
  null,
  "Точный размер"
 ],
 "Size unit": [
  null,
  "Единица измерения"
 ],
 "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
  null,
  "Ограничения на размер файловой системы. Конечный размер будет равен значению между заданным минимумом и максимумом. Если максимальное значение не задано, то файловая система будет такой большой, на сколько это возможно."
 ],
 "Minimum": [
  null,
  "Минимум"
 ],
 "Minimum desired size": [
  null,
  "Минимальный желаемый размер"
 ],
 "Unit for the minimum size": [
  null,
  "Единица для минимального размера"
 ],
 "Maximum": [
  null,
  "Максимум"
 ],
 "Maximum desired size": [
  null,
  "Максимальный желаемый размер"
 ],
 "Unit for the maximum size": [
  null,
  "Единица для максимального размера"
 ],
 "Auto": [
  null,
  "Автоматически"
 ],
 "Fixed": [
  null,
  "Фиксированный"
 ],
 "Range": [
  null,
  "Диапазон"
 ],
 "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
  null,
  "По умолчанию файловые системы распределяются на устройстве установки. Укажите пользовательское расположение, чтобы создать файловую систему на конкретном устройстве."
 ],
 "Location for %s file system": [
  null,
  "Расположение файловой системы %s"
 ],
 "Select in which device to allocate the file system": [
  null,
  "Выберите, на каком устройстве разместить файловую систему"
 ],
 "Select a location": [
  null,
  "Выберите расположение"
 ],
 "Select how to allocate the file system": [
  null,
  "Выберите способ выделения файловой системы"
 ],
 "Create a new partition": [
  null,
  "Создать новый раздел"
 ],
 "The file system will be allocated as a new partition at the selected   disk.": [
  null,
  "Файловая система будет выделена в качестве нового раздела на выбранном   диске."
 ],
 "Create a dedicated LVM volume group": [
  null,
  "Создать выделенную группу томов LVM"
 ],
 "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
  null,
  "На выбранном диске будет выделена новая группа томов, а   файловая система будет создана как логический том."
 ],
 "Format the device": [
  null,
  "Отформатировать устройство"
 ],
 "The selected device will be formatted as %s file system.": [
  null,
  "Выбранное устройство будет отформатировано в файловую систему %s."
 ],
 "Mount the file system": [
  null,
  "Смонтировать файловую систему"
 ],
 "The current file system on the selected device will be mounted   without formatting the device.": [
  null,
  "Текущая файловая система на выбранном устройстве будет смонтирована   без форматирования устройства."
 ],
 "Usage": [
  null,
  "Использование"
 ],
 "Formatting DASD devices": [
  null,
  "Форматирование устройств DASD"
 ],
 "No": [
  null,
  "Нет"
 ],
 "Yes": [
  null,
  "Да"
 ],
 "Channel ID": [
  null,
  "Идентификатор канала"
 ],
 "Status": [
  null,
  "Состояние"
 ],
 "Type": [
  null,
  "Тип"
 ],
 "DIAG": [
  null,
  "Режим DIAG"
 ],
 "Formatted": [
  null,
  "Отформатированный"
 ],
 "Partition Info": [
  null,
  "Информация о разделе"
 ],
 "Cannot format all selected devices": [
  null,
  ""
 ],
 "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
  null,
  ""
 ],
 "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
  null,
  ""
 ],
 "Perform an action": [
  null,
  "Выполнить действие"
 ],
 "Activate": [
  null,
  "Активировать"
 ],
 "Deactivate": [
  null,
  "Деактивировать"
 ],
 "Set DIAG On": [
  null,
  "Включить DIAG"
 ],
 "Set DIAG Off": [
  null,
  "Отключить DIAG"
 ],
 "Format": [
  null,
  "Формат"
 ],
 "Filter by min channel": [
  null,
  "Фильтр по минимальному каналу"
 ],
 "Remove min channel filter": [
  null,
  "Удалить фильтр по минимальному каналу"
 ],
 "Filter by max channel": [
  null,
  "Фильтр по максимальному каналу"
 ],
 "Remove max channel filter": [
  null,
  "Удалить фильтр по максимальному каналу"
 ],
 "Unused space": [
  null,
  "Неиспользуемое пространство"
 ],
 "Only available if authentication by target is provided": [
  null,
  "Доступно только при условии аутентификации по цели"
 ],
 "Authentication by target": [
  null,
  "Аутентификация по цели"
 ],
 "User name": [
  null,
  "Имя пользователя"
 ],
 "Incorrect user name": [
  null,
  "Некорректное имя пользователя"
 ],
 "Incorrect password": [
  null,
  "Некорректный пароль"
 ],
 "Authentication by initiator": [
  null,
  "Аутентификация инициатором"
 ],
 "Target Password": [
  null,
  "Пароль цели"
 ],
 "Discover iSCSI Targets": [
  null,
  "Знакомство с целевыми устройствами iSCSI"
 ],
 "Make sure you provide the correct values": [
  null,
  "Убедитесь, что вы указали правильные значения"
 ],
 "IP address": [
  null,
  "IP-адрес"
 ],
 "Address": [
  null,
  "Адрес"
 ],
 "Incorrect IP address": [
  null,
  "Некорректный IP-адрес"
 ],
 "Port": [
  null,
  "Порт"
 ],
 "Incorrect port": [
  null,
  "Некорректный порт"
 ],
 "Edit %s": [
  null,
  "Изменить %s"
 ],
 "Edit iSCSI Initiator": [
  null,
  "Изменить инициатор iSCSI"
 ],
 "Initiator name": [
  null,
  "Имя инициатора"
 ],
 "iBFT": [
  null,
  "iBFT"
 ],
 "Offload card": [
  null,
  "Разгрузочная карта"
 ],
 "Initiator": [
  null,
  "Инициатор"
 ],
 "Login %s": [
  null,
  "Логин %s"
 ],
 "Startup": [
  null,
  "Запуск"
 ],
 "On boot": [
  null,
  "При загрузке"
 ],
 "Connected (%s)": [
  null,
  "Подключено (%s)"
 ],
 "Login": [
  null,
  "Вход"
 ],
 "Logout": [
  null,
  "Выход"
 ],
 "Portal": [
  null,
  "Портал"
 ],
 "Interface": [
  null,
  "Интерфейс"
 ],
 "No iSCSI targets found.": [
  null,
  "Цели iSCSI не найдены."
 ],
 "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
  null,
  "Выполните обнаружение iSCSI, чтобы найти доступные цели iSCSI."
 ],
 "Discover iSCSI targets": [
  null,
  "Обнаружение целей iSCSI"
 ],
 "Discover": [
  null,
  "Обнаружить"
 ],
 "Targets": [
  null,
  "Цели"
 ],
 "KiB": [
  null,
  "КиБ"
 ],
 "MiB": [
  null,
  "МиБ"
 ],
 "GiB": [
  null,
  "ГиБ"
 ],
 "TiB": [
  null,
  "ТиБ"
 ],
 "PiB": [
  null,
  "ПиБ"
 ],
 "Delete current content": [
  null,
  "Удалить текущее содержимое"
 ],
 "All partitions will be removed and any data in the disks will be lost.": [
  null,
  "Все разделы будут удалены, а все данные на дисках будут потеряны."
 ],
 "deleting current content": [
  null,
  "удаление текущего содержимого"
 ],
 "Shrink existing partitions": [
  null,
  "Уменьшение существующих разделов"
 ],
 "The data is kept, but the current partitions will be resized as needed.": [
  null,
  "Данные сохраняются, но размер текущих разделов будет изменен по мере необходимости."
 ],
 "shrinking partitions": [
  null,
  "уменьшение разделов"
 ],
 "Use available space": [
  null,
  "Использовать свободное пространство"
 ],
 "The data is kept. Only the space not assigned to any partition will be used.": [
  null,
  "Данные сохраняются. Будет использовано только пространство, не отведенное для какого-либо раздела."
 ],
 "without modifying any partition": [
  null,
  "не изменяя ни одного раздела"
 ],
 "Custom": [
  null,
  "По-своему"
 ],
 "Select what to do with each partition.": [
  null,
  "Выберите, что делать с каждым разделом."
 ],
 "with custom actions": [
  null,
  "другими способами"
 ],
 "Auto LUNs Scan": [
  null,
  "Автоматическое сканирование LUN"
 ],
 "Activated": [
  null,
  "Активировано"
 ],
 "Deactivated": [
  null,
  "Деактивировано"
 ],
 "zFCP Disk Activation": [
  null,
  ""
 ],
 "zFCP Disk activation form": [
  null,
  ""
 ],
 "The zFCP disk was not activated.": [
  null,
  "Диск zFCP не был активирован."
 ],
 "WWPN": [
  null,
  "WWPN"
 ],
 "LUN": [
  null,
  "LUN"
 ],
 "Please, try to activate a zFCP disk.": [
  null,
  "Пожалуйста, попробуйте активировать диск zFCP."
 ],
 "Please, try to activate a zFCP controller.": [
  null,
  "Пожалуйста, попробуйте активировать контроллер zFCP."
 ],
 "No zFCP disks found.": [
  null,
  "Диски zFCP не найдены."
 ],
 "Activate zFCP disk": [
  null,
  "Активировать диск zFCP"
 ],
 "Activate new disk": [
  null,
  "Активировать новый диск"
 ],
 "Disks": [
  null,
  "Диски"
 ],
 "Controllers": [
  null,
  ""
 ],
 "No zFCP controllers found.": [
  null,
  "Контроллеры zFCP не найдены."
 ],
 "Read zFCP devices": [
  null,
  "Прочитать устройства zFCP"
 ],
 "Define a user now": [
  null,
  "Определить пользователя"
 ],
 "No user defined yet.": [
  null,
  "Пользователь еще не определен."
 ],
 "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
  null,
  "Обратите внимание, что перед установкой системы необходимо определить пользователя, чтобы он мог войти в систему."
 ],
 "Full name": [
  null,
  "Полное имя"
 ],
 "Username": [
  null,
  "Имя пользователя"
 ],
 "Discard": [
  null,
  "Отказаться"
 ],
 "First user": [
  null,
  "Первый пользователь"
 ],
 "Username suggestion dropdown": [
  null,
  "Выпадающий список с предложением имени пользователя"
 ],
 "Use suggested username": [
  null,
  "Используйте предложенное имя пользователя"
 ],
 "All fields are required": [
  null,
  "Все поля обязательны"
 ],
 "Create user": [
  null,
  "Создать пользователя"
 ],
 "Edit user": [
  null,
  "Изменить пользователя"
 ],
 "User full name": [
  null,
  "Полное имя пользователя"
 ],
 "Edit password too": [
  null,
  "Также изменить пароль"
 ],
 "user autologin": [
  null,
  "автоматический вход пользователя"
 ],
 "Auto-login": [
  null,
  "Автологин"
 ],
 "No root authentication method defined yet.": [
  null,
  "Метод корневой аутентификации пока не определен."
 ],
 "Please, define at least one authentication method for logging into the system as root.": [
  null,
  "Пожалуйста, определите хотя бы один метод аутентификации для входа в систему с правами root."
 ],
 "Method": [
  null,
  "Метод"
 ],
 "Already set": [
  null,
  "Уже установлен"
 ],
 "Not set": [
  null,
  "Не установлен"
 ],
 "SSH Key": [
  null,
  "Ключ SSH"
 ],
 "Set": [
  null,
  "Установить"
 ],
 "Root authentication": [
  null,
  "Аутентификация root"
 ],
 "Set a password": [
  null,
  "Установить пароль"
 ],
 "Upload a SSH Public Key": [
  null,
  "Загрузить публичный ключ SSH"
 ],
 "Change the root password": [
  null,
  "Изменить пароль root"
 ],
 "Set a root password": [
  null,
  "Установить пароль root"
 ],
 "Edit the SSH Public Key for root": [
  null,
  "Изменить публичный ключ SSH для root"
 ],
 "Add a SSH Public Key for root": [
  null,
  "Добавить публичный ключ SSH для root"
 ],
 "Root password": [
  null,
  "Пароль root"
 ],
 "Set root SSH public key": [
  null,
  "Установить публичный ключ SSH для root"
 ],
 "Root SSH public key": [
  null,
  "Публичный ключ SSH для root"
 ],
 "Upload, paste, or drop an SSH public key": [
  null,
  "Загрузите, вставьте или сбросьте публичный ключ SSH"
 ],
 "Upload": [
  null,
  "Загрузить"
 ],
 "Clear": [
  null,
  "Очистить"
 ],
 "ZFCP": [
  null,
  ""
 ]
});
