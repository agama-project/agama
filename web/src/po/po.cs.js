import agama from "../agama";

agama.locale({
  "": {
    "plural-forms": (n) => (n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2,
    "language": "cs"
  },
  " Timezone selection": [
    " Výběr časového pásma"
  ],
  " and ": [
    " a "
  ],
  "%1$s %2$s at %3$s (%4$s)": [
    "%1$s %2$s na %3$s (%4$s)"
  ],
  "%1$s %2$s partition (%3$s)": [
    "%1$s %2$s oddíl (%3$s)"
  ],
  "%1$s %2$s volume (%3$s)": [
    "%1$s %2$s svazek (%3$s)"
  ],
  "%1$s root at %2$s (%3$s)": [
    "%1$s kořen na %2$s (%3$s)"
  ],
  "%1$s root partition (%2$s)": [
    "%1$s kořenový oddíl (%2$s)"
  ],
  "%1$s root volume (%2$s)": [
    "%1$s kořenový svazek (%2$s)"
  ],
  "%d partition will be shrunk": [
    "%d oddíl bude zmenšen",
    "%d oddíly budou zmenšeny",
    "%d oddílů bude zmenšeno"
  ],
  "%s disk": [
    "%s disk"
  ],
  "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
    "%s je neměnný systém s atomickými aktualizacemi. Používá souborový systém Btrfs pouze pro čtení aktualizovaný pomocí snímků."
  ],
  "%s logo": [
    "%s logo"
  ],
  "%s with %d partitions": [
    "%s s %d oddíly"
  ],
  ", ": [
    ", "
  ],
  "A mount point is required": [
    "Je vyžadován přípojný bod"
  ],
  "A new LVM Volume Group": [
    "Nová skupina svazků LVM"
  ],
  "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
    "Na vybraném disku bude vytvořena nová skupina svazků a   systém souborů bude vytvořen jako logický svazek."
  ],
  "A size value is required": [
    "Je vyžadována hodnota velikosti"
  ],
  "Accept": [
    "Přijmout"
  ],
  "Action": [
    "Akce"
  ],
  "Actions": [
    "Akce"
  ],
  "Actions for connection %s": [
    "Akce pro připojení %s"
  ],
  "Actions to find space": [
    "Akce k nalezení prostoru"
  ],
  "Activate": [
    "Aktivace"
  ],
  "Activate disks": [
    "Aktivace disků"
  ],
  "Activate new disk": [
    "Aktivace nového disku"
  ],
  "Activate zFCP disk": [
    "Aktivovat disk zFCP"
  ],
  "Activated": [
    "Aktivováno"
  ],
  "Add %s file system": [
    "Přidání souborového systému %s"
  ],
  "Add DNS": [
    "Přidat DNS"
  ],
  "Add a SSH Public Key for root": [
    "Přidat veřejný klíč SSH pro uživatele root"
  ],
  "Add an address": [
    "Přidat adresu"
  ],
  "Add another DNS": [
    "Přidat další DNS"
  ],
  "Add another address": [
    "Přidat další adresu"
  ],
  "Add file system": [
    "Přidat souborový systém"
  ],
  "Address": [
    "Adresa"
  ],
  "Addresses": [
    "Adresy"
  ],
  "Addresses data list": [
    "Seznam údajů o adresách"
  ],
  "All fields are required": [
    "Všechna pole jsou povinná"
  ],
  "All partitions will be removed and any data in the disks will be lost.": [
    "Všechny oddíly budou odstraněny a veškerá data na discích budou ztracena."
  ],
  "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
    "Umožňuje zavést předchozí verzi systému po změně konfigurace nebo aktualizaci softwaru."
  ],
  "Already set": [
    "Již nastaveno"
  ],
  "An existing disk": [
    "Existující disk"
  ],
  "At least one address must be provided for selected mode": [
    "Pro zvolený režim musí být uvedena alespoň jedna adresa"
  ],
  "At this point you can power off the machine.": [
    "Nyní můžete počítač vypnout."
  ],
  "At this point you can reboot the machine to log in to the new system.": [
    "Nyní můžete počítač restartovat a přihlásit se do nového systému."
  ],
  "Authentication by initiator": [
    "Ověření iniciátorem"
  ],
  "Authentication by target": [
    "Ověřování cílem"
  ],
  "Authentication failed, please try again": [
    "Ověření selhalo, zkuste to znovu"
  ],
  "Auto": [
    "Auto"
  ],
  "Auto LUNs Scan": [
    "Automatické skenování jednotek LUN"
  ],
  "Auto-login": [
    "Automatické přihlášení"
  ],
  "Automatic": [
    "Automatický"
  ],
  "Automatic (DHCP)": [
    "Automatická (DHCP)"
  ],
  "Automatic LUN scan is [disabled]. LUNs have to be manually       configured after activating a controller.": [
    "Automatické skenování LUN je [zakázáno]. Po aktivaci řadiče        je třeba LUNy konfigurovat ručně."
  ],
  "Automatic LUN scan is [enabled]. Activating a controller which is       running in NPIV mode will automatically configures all its LUNs.": [
    "Automatické skenování LUN je [povoleno]. Aktivací řadiče,       běžícího v režimu NPIV, se automaticky zkonfigurují všechny jeho LUN."
  ],
  "Automatically calculated size according to the selected product.": [
    "Automatický výpočet velikosti podle vybraného produktu."
  ],
  "Available products": [
    "Dostupné produkty"
  ],
  "Back": [
    "Zpět"
  ],
  "Back to device selection": [
    "Zpět na výběr zařízení"
  ],
  "Before %s": [
    "Před %s"
  ],
  "Before installing, please check the following problems.": [
    "Před instalací zkontrolujte tyto problémy."
  ],
  "Before starting the installation, you need to address the following problems:": [
    "Před zahájením instalace vyřešte tyto problémy:"
  ],
  "Boot partitions at %s": [
    "Zaváděcí oddíly na %s"
  ],
  "Boot partitions at installation disk": [
    "Oddíly zavádějící systém na instalačním disku"
  ],
  "Btrfs root partition with snapshots (%s)": [
    "Kořenový oddíl Btrfs se snímky (%s)"
  ],
  "Btrfs root volume with snapshots (%s)": [
    "Kořenový svazek Btrfs se snímky (%s)"
  ],
  "Btrfs with snapshots": [
    "Btrfs se snímky"
  ],
  "Cancel": [
    "Zrušit"
  ],
  "Cannot accommodate the required file systems for installation": [
    "Nelze umístit požadované souborové systémy pro instalaci"
  ],
  "Cannot be changed in remote installation": [
    "U instalace na dálku nelze změnit"
  ],
  "Cannot connect to Agama server": [
    "Nelze se připojit k serveru Agama"
  ],
  "Cannot format all selected devices": [
    "Nelze formátovat všechna vybraná zařízení"
  ],
  "Change": [
    "Změnit"
  ],
  "Change boot options": [
    "Změna možností spouštění systému"
  ],
  "Change location": [
    "Změna umístění"
  ],
  "Change product": [
    "Změnit produkt"
  ],
  "Change selection": [
    "Změnit výběr"
  ],
  "Change the root password": [
    "Změna hesla roota"
  ],
  "Channel ID": [
    "ID kanálu"
  ],
  "Check the planned action": [
    "Zkontrolujte plánovanou akci",
    "Zkontrolujte %d plánované akce",
    "Zkontrolujte %d plánovaných akcí"
  ],
  "Choose a disk for placing the boot loader": [
    "Výběr disku pro umístění zavaděče"
  ],
  "Clear": [
    "Smazat"
  ],
  "Close": [
    "Zavřít"
  ],
  "Configuring the product, please wait ...": [
    "Konfigurace produktu, počkejte prosím..."
  ],
  "Confirm": [
    "Potvrdit"
  ],
  "Confirm Installation": [
    "Potvrdit instalaci"
  ],
  "Congratulations!": [
    "Blahopřejeme!"
  ],
  "Connect": [
    "Připojit"
  ],
  "Connect to a Wi-Fi network": [
    "Připojení k síti Wi-Fi"
  ],
  "Connect to hidden network": [
    "Připojit ke skryté síti"
  ],
  "Connect to iSCSI targets": [
    "Připojení k cílům iSCSI"
  ],
  "Connected": [
    "Připojeno"
  ],
  "Connected (%s)": [
    "Připojeno (%s)"
  ],
  "Connected to %s": [
    "Připojeno k %s"
  ],
  "Connecting": [
    "Připojování"
  ],
  "Connection actions": [
    "Akce připojení"
  ],
  "Continue": [
    "Pokračovat"
  ],
  "Controllers": [
    "Řadiče"
  ],
  "Could not authenticate against the server, please check it.": [
    "Nezdařilo se ověření vůči serveru, zkontrolujte to prosím."
  ],
  "Could not log in. Please, make sure that the password is correct.": [
    "Nelze se přhlásit. Zkontrolujte správnost hesla."
  ],
  "Create a dedicated LVM volume group": [
    "Vytvoření vyhrazené skupiny svazků LVM"
  ],
  "Create a new partition": [
    "Vytvořit nový oddíl"
  ],
  "Create user": [
    "Vytvořit uživatele"
  ],
  "Custom": [
    "Vlastní"
  ],
  "DASD": [
    "DASD"
  ],
  "DASD %s": [
    "DASD %s"
  ],
  "DASD devices selection table": [
    "Tabulka výběru zařízení DASD"
  ],
  "DASDs table section": [
    "Sekce DASD tabulky"
  ],
  "DIAG": [
    "DIAG"
  ],
  "DNS": [
    "DNS"
  ],
  "Deactivate": [
    "Deaktivace"
  ],
  "Deactivated": [
    "Deaktivováno"
  ],
  "Define a user now": [
    "Nyní definujte uživatele"
  ],
  "Delete": [
    "Smazat"
  ],
  "Delete current content": [
    "Odstranit aktuální obsah"
  ],
  "Destructive actions are allowed": [
    "Destruktivní akce jsou povoleny"
  ],
  "Destructive actions are not allowed": [
    "Destruktivní akce nejsou povoleny"
  ],
  "Details": [
    "Podrobnosti"
  ],
  "Device": [
    "Zařízení"
  ],
  "Device selector for new LVM volume group": [
    "Výběr zařízení pro novou skupinu svazků LVM"
  ],
  "Device selector for target disk": [
    "Výběr zařízení pro cílový disk"
  ],
  "Devices: %s": [
    "Zařízení: %s"
  ],
  "Discard": [
    "Vyřadit"
  ],
  "Disconnect": [
    "Odpojit"
  ],
  "Disconnected": [
    "Odpojeno"
  ],
  "Discover": [
    "Objevit"
  ],
  "Discover iSCSI Targets": [
    "Najít cílové stanice iSCSI"
  ],
  "Discover iSCSI targets": [
    "Zjištění cílů iSCSI"
  ],
  "Disk": [
    "Disk"
  ],
  "Disks": [
    "Disky"
  ],
  "Do not configure": [
    "Nekonfigurujte"
  ],
  "Do not configure partitions for booting": [
    "Nekonfigurujte oddíly pro zavádění systému"
  ],
  "Do you want to add it?": [
    "Chcete ho přidat?"
  ],
  "Do you want to edit it?": [
    "Chcete to upravit?"
  ],
  "Download logs": [
    "Stáhnout protokoly"
  ],
  "Edit": [
    "Upravit"
  ],
  "Edit %s": [
    "Upravit %s"
  ],
  "Edit %s file system": [
    "Upravit souborový systém %s"
  ],
  "Edit connection %s": [
    "Upravit připojení %s"
  ],
  "Edit file system": [
    "Úprava souborového systému"
  ],
  "Edit iSCSI Initiator": [
    "Upravit iniciátor iSCSI"
  ],
  "Edit password too": [
    "Upravit také heslo"
  ],
  "Edit the SSH Public Key for root": [
    "Úprava veřejného klíče SSH pro uživatele root"
  ],
  "Edit user": [
    "Upravit uživatele"
  ],
  "Enable": [
    "Zapojit"
  ],
  "Encrypt the system": [
    "Šifrování systému"
  ],
  "Encrypted Device": [
    "Šifrované zařízení"
  ],
  "Encryption": [
    "Šifrování"
  ],
  "Encryption Password": [
    "Heslo pro šifrování"
  ],
  "Exact size": [
    "Přesná velikost"
  ],
  "Exact size for the file system.": [
    "Přesná velikost souborového systému."
  ],
  "File system type": [
    "Typ systému souborů"
  ],
  "File systems created as new partitions at %s": [
    "Souborové systémy vytvořené jako nové oddíly v %s"
  ],
  "File systems created at a new LVM volume group": [
    "Souborové systémy vytvořené v nové skupině svazků LVM"
  ],
  "File systems created at a new LVM volume group on %s": [
    "Souborové systémy vytvořené v nové skupině svazků LVM na %s"
  ],
  "Filter by description or keymap code": [
    "Filtrování podle popisu nebo kódu mapy kláves"
  ],
  "Filter by language, territory or locale code": [
    "Filtrování podle jazyka, území nebo kódu lokality"
  ],
  "Filter by max channel": [
    "Filtrování podle max. kanálu"
  ],
  "Filter by min channel": [
    "Filtrování podle min. kanálu"
  ],
  "Filter by pattern title or description": [
    "Filtrování podle názvu nebo popisu vzoru"
  ],
  "Filter by territory, time zone code or UTC offset": [
    "Filtrování podle území, kódu časového pásma nebo posunu od UTC"
  ],
  "Final layout": [
    "Konečné rozvržení"
  ],
  "Finish": [
    "Dokončit"
  ],
  "Finished": [
    "Dokončeno"
  ],
  "First user": [
    "První uživatel"
  ],
  "Fixed": [
    "Opraveno"
  ],
  "Forget": [
    "Zapomenout"
  ],
  "Forget connection %s": [
    "Zapomenout připojení %s"
  ],
  "Format": [
    "Formát"
  ],
  "Format selected devices?": [
    "Formátovat vybraná zařízení?"
  ],
  "Format the device": [
    "Formátovat zařízení"
  ],
  "Formatted": [
    "Formátován"
  ],
  "Formatting DASD devices": [
    "Formátuji zařízení DASD"
  ],
  "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
    "Šifrování celého disku (FDE) umožňuje chránit informace uložené v zařízení, včetně dat, programů a systémových souborů."
  ],
  "Full name": [
    "Celé jméno"
  ],
  "Gateway": [
    "Brána"
  ],
  "Gateway can be defined only in 'Manual' mode": [
    "Bránu lze definovat pouze v režimu 'Ruční'"
  ],
  "GiB": [
    "GiB"
  ],
  "Hide %d subvolume action": [
    "Skrýt %d akci podsvazku",
    "Skrýt %d akce podsvazku",
    "Skrýt %d akcí podsvazku"
  ],
  "Hide details": [
    "Skrýt podrobnosti"
  ],
  "IP Address": [
    "IP adresa"
  ],
  "IP address": [
    "adresa IP"
  ],
  "IP addresses": [
    "IP adresy"
  ],
  "If a local media was used to run this installer, remove it before the next boot.": [
    "Bylo-li ke spuštění tohoto instalačního programu použito místní médium, před dalším spuštěním ho odstraňte."
  ],
  "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
    "Budete-li pokračovat, oddíly na pevném disku budou upraveny podle zadaných instalačních nastavení."
  ],
  "In progress": [
    "Probíhá"
  ],
  "Incorrect IP address": [
    "Nesprávná IP adresa"
  ],
  "Incorrect password": [
    "Nesprávné heslo"
  ],
  "Incorrect port": [
    "Nesprávný port"
  ],
  "Incorrect user name": [
    "Nesprávné uživatelské jméno"
  ],
  "Initiator": [
    "Iniciátor"
  ],
  "Initiator name": [
    "Název iniciátora"
  ],
  "Install": [
    "Instalovat"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager), která odstraní veškerý obsah podkladových zařízení"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager) na %s s odstraněním veškerého jejich obsahu"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager) na %s se zmenšením stávajících oddílů podle potřeby"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager) na %s s použitím vlastní strategie pro nalezení potřebného místa"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager) na %s bez úpravy existujících oddílů"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager), která podle potřeby zmenší existující oddíly na podkladových zařízeních"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
    "Instalace do nové skupiny svazků LVM (Logical Volume Manager) pomocí vlastní strategie pro nalezení potřebného místa v podkladových zařízeních"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
    "Instalace do nové skupiny svazků Správce logických svazků (LVM) bez úpravy oddílů na podkladových zařízeních"
  ],
  "Install new system on": [
    "Instalace nového systému na"
  ],
  "Install using device %s and deleting all its content": [
    "Instalace pomocí zařízení %s a odstranění veškerého jeho obsahu"
  ],
  "Install using device %s shrinking existing partitions as needed": [
    "Instalace pomocí zařízení %s se zmenšením stávajících oddílů podle potřeby"
  ],
  "Install using device %s with a custom strategy to find the needed space": [
    "Instalace pomocí zařízení %s s vlastní strategií pro vyhledání potřebného místa"
  ],
  "Install using device %s without modifying existing partitions": [
    "Instalace pomocí zařízení %s bez úpravy stávajících oddílů"
  ],
  "Installation blocking issues": [
    "Problémy zabraňující instalaci"
  ],
  "Installation device": [
    "Instalační zařízení"
  ],
  "Installation issues": [
    "Problémy s instalací"
  ],
  "Installation not possible yet because of issues. Check them at Overview page.": [
    "Instalace zatím není možná kvůli problémům, které najdete na stránce Přehled."
  ],
  "Installation will configure partitions for booting at %s.": [
    "Instalace nakonfiguruje oddíly pro zavádění v %s."
  ],
  "Installation will configure partitions for booting at the installation disk.": [
    "Instalace nakonfiguruje oddíly pro zavádění na instalačním disku."
  ],
  "Installation will not configure partitions for booting.": [
    "Instalace nenakonfiguruje oddíly pro zavádění systému."
  ],
  "Installation will take %s.": [
    "Instalace bude trvat %s."
  ],
  "Installer Options": [
    "Možnosti instalátoru"
  ],
  "Installer options": [
    "Možnosti instalátoru"
  ],
  "Installing the system, please wait...": [
    "Instaluji systém, čekejte ..."
  ],
  "Interface": [
    "Rozhraní"
  ],
  "Ip prefix or netmask": [
    "Předpona IP nebo maska sítě"
  ],
  "Keyboard": [
    "Klávesnice"
  ],
  "Keyboard layout": [
    "Rozložení kláves"
  ],
  "Keyboard selection": [
    "Výběr klávesnice"
  ],
  "KiB": [
    "KiB"
  ],
  "LUN": [
    "LUN"
  ],
  "Language": [
    "Jazyk"
  ],
  "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
    "Omezení velikosti souborového systému. Konečná velikost bude hodnota mezi zadaným minimem a maximem. Pokud není zadáno žádné maximum, bude souborový systém co největší."
  ],
  "Loading data...": [
    "Načítání dat ..."
  ],
  "Loading installation environment, please wait.": [
    "Načítá se instalační prostředí, vyčkejte prosím."
  ],
  "Locale selection": [
    "Výběr lokality"
  ],
  "Localization": [
    "Lokalizace"
  ],
  "Location": [
    "Umístění"
  ],
  "Location for %s file system": [
    "Umístění souborového systému %s"
  ],
  "Log in": [
    "Přihlásit se"
  ],
  "Log in as %s": [
    "Přihlásit se jako %s"
  ],
  "Logical volume at system LVM": [
    "Logický svazek na systému LVM"
  ],
  "Login": [
    "Přihlášení"
  ],
  "Login %s": [
    "Přihlášení %s"
  ],
  "Login form": [
    "Přihlašovací formulář"
  ],
  "Logout": [
    "Odhlášení"
  ],
  "Main disk or LVM Volume Group for installation.": [
    "Hlavní disk nebo skupina svazků LVM pro instalaci."
  ],
  "Main navigation": [
    "Hlavní navigace"
  ],
  "Make sure you provide the correct values": [
    "Ujistěte se, že jste zadali správné hodnoty"
  ],
  "Manage and format": [
    "Správa a formátování"
  ],
  "Manual": [
    "Ruční"
  ],
  "Maximum": [
    "Maximum"
  ],
  "Maximum desired size": [
    "Maximální požadovaná velikost"
  ],
  "Maximum must be greater than minimum": [
    "Maximum musí být větší než minimum"
  ],
  "Members: %s": [
    "Členové: %s"
  ],
  "Method": [
    "Metoda"
  ],
  "MiB": [
    "MiB"
  ],
  "Minimum": [
    "Minimum"
  ],
  "Minimum desired size": [
    "Minimální požadovaná velikost"
  ],
  "Minimum size is required": [
    "Je vyžadována minimální velikost"
  ],
  "Mode": [
    "Režim"
  ],
  "Modify": [
    "Upravit"
  ],
  "More info for file system types": [
    "Další informace o typech souborových systémů"
  ],
  "Mount %1$s at %2$s (%3$s)": [
    "Připojit %1$s at %2$s (%3$s)"
  ],
  "Mount Point": [
    "Přípojný bod"
  ],
  "Mount point": [
    "Přípojný bod"
  ],
  "Mount the file system": [
    "Připojit souborový systém"
  ],
  "Multipath": [
    "Vícecestný"
  ],
  "Name": [
    "Název"
  ],
  "Network": [
    "Síť"
  ],
  "New": [
    "Nový"
  ],
  "No": [
    "Ne"
  ],
  "No Wi-Fi supported": [
    "Wi-Fi není podporováno"
  ],
  "No additional software was selected.": [
    "Nebyl vybrán žádný další software."
  ],
  "No connected yet": [
    "Dosud nepřipojeno"
  ],
  "No content found": [
    "Nebyl nalezen žádný obsah"
  ],
  "No device selected yet": [
    "Zatím nebylo vybráno žádné zařízení"
  ],
  "No iSCSI targets found.": [
    "Nebyly nalezeny žádné cíle iSCSI."
  ],
  "No partitions will be automatically configured for booting. Use with caution.": [
    "Žádné oddíly nebudou automaticky konfigurovány pro zavádění systému. Používejte opatrně."
  ],
  "No root authentication method defined yet.": [
    "Zatím není definována žádná metoda ověřování superuživatele root."
  ],
  "No user defined yet.": [
    "Zatím není definován žádný uživatel."
  ],
  "No visible Wi-Fi networks found": [
    "Nebyly nalezeny žádné viditelné sítě Wi-Fi"
  ],
  "No wired connections found": [
    "Nebyla nalezena žádná kabelová připojení"
  ],
  "No zFCP controllers found.": [
    "Nebyly nalezeny žádné řadiče zFCP."
  ],
  "No zFCP disks found.": [
    "Nebyly nalezeny žádné disky zFCP."
  ],
  "None": [
    "Žádné"
  ],
  "None of the keymaps match the filter.": [
    "Žádná z map kláves neodpovídá filtru."
  ],
  "None of the locales match the filter.": [
    "Žádné umístění neodpovídá filtru."
  ],
  "None of the patterns match the filter.": [
    "Žádný ze vzorů neodpovídá filtru."
  ],
  "None of the time zones match the filter.": [
    "Žádné z časových pásem neodpovídá filtru."
  ],
  "Not selected yet": [
    "Dosud nevybráno"
  ],
  "Not set": [
    "Nenastaveno"
  ],
  "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
    "Offline zařízení musí být před formátováním aktivována. Buďto zrušte jejich výběr nebo níže uvedená zařízení aktivujte a zkuste to znovu"
  ],
  "Offload card": [
    "Karta k přesměrování části (mobilního) provozu"
  ],
  "On boot": [
    "Při spuštění systému"
  ],
  "Only available if authentication by target is provided": [
    "K dispozici, jen když je zadáno ověřování cílem"
  ],
  "Options toggle": [
    "Přepínač možností"
  ],
  "Other": [
    "Ostatní/jiné"
  ],
  "Overview": [
    "Přehled"
  ],
  "Partition Info": [
    "Údaje o oddílech"
  ],
  "Partition at %s": [
    "Oddíl na %s"
  ],
  "Partition at installation disk": [
    "Oddíl na instalačním disku"
  ],
  "Partitions and file systems": [
    "Oddíly a souborové systémy"
  ],
  "Partitions to boot will be allocated at the following device.": [
    "Oddíly pro zavádění budou přiděleny na tomto zařízení."
  ],
  "Partitions to boot will be allocated at the installation disk (%s).": [
    "Oddíly pro zavádění budou přiděleny na instalačním disku (%s)."
  ],
  "Partitions to boot will be allocated at the installation disk.": [
    "Oddíly pro zavádění budou přiděleny na instalačním disku."
  ],
  "Password": [
    "Heslo"
  ],
  "Password Required": [
    "Vyžadováno heslo"
  ],
  "Password confirmation": [
    "Potvrzení hesla"
  ],
  "Password input": [
    "Zadejte heslo"
  ],
  "Password visibility button": [
    "Tlačítko viditelnosti hesla"
  ],
  "Passwords do not match": [
    "Hesla se neshodují"
  ],
  "Pending": [
    "Čeká se na"
  ],
  "Perform an action": [
    "Provést akci"
  ],
  "PiB": [
    "PiB"
  ],
  "Planned Actions": [
    "Plánované akce"
  ],
  "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
    "Pozor, před instalací systému musí být definován uživatel, aby se pak do systému dalo přihlásit."
  ],
  "Please, cancel and check the settings if you are unsure.": [
    "Nejste-li si jisti, zrušte akci a zkontrolujte nastavení."
  ],
  "Please, check whether it is running.": [
    "Zkontrolujte, zda je spuštěn."
  ],
  "Please, define at least one authentication method for logging into the system as root.": [
    "Definujte alespoň jednu metodu ověřování pro přihlášení do systému jako root."
  ],
  "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
    "Spusťte vyhledávání iSCSI a tím najděte dostupné cíle iSCSI."
  ],
  "Please, provide its password to log in to the system.": [
    "Zadejte heslo pro přihlášení do systému."
  ],
  "Please, review provided settings and try again.": [
    "Zkontrolujte poskytnutá nastavení a zkuste to znovu."
  ],
  "Please, try to activate a zFCP controller.": [
    "Zkuste aktivovat řadič zFCP."
  ],
  "Please, try to activate a zFCP disk.": [
    "Zkuste aktivovat disk zFCP."
  ],
  "Port": [
    "Port"
  ],
  "Portal": [
    "Portál"
  ],
  "Prefix length or netmask": [
    "Délka předpony nebo maska sítě"
  ],
  "Prepare more devices by configuring advanced": [
    "Připravte další zařízení pomocí pokročilé konfigurace"
  ],
  "Presence of other volumes (%s)": [
    "Přítomnost dalších svazků (%s)"
  ],
  "Protection for the information stored at the device, including data, programs, and system files.": [
    "Ochrana informací uložených v zařízení, včetně dat, programů a systémových souborů."
  ],
  "Question": [
    "Dotaz"
  ],
  "Range": [
    "Rozsah"
  ],
  "Read zFCP devices": [
    "Načtení zařízení zFCP"
  ],
  "Reboot": [
    "Restartovat systém"
  ],
  "Reload": [
    "Znovu načíst"
  ],
  "Remove": [
    "Odstranit"
  ],
  "Remove max channel filter": [
    "Odstranění filtru max. kanálu"
  ],
  "Remove min channel filter": [
    "Odstranění filtru min. kanálu"
  ],
  "Reset location": [
    "Výmaz umístění"
  ],
  "Reset to defaults": [
    "Návrat k standardním hodnotám"
  ],
  "Reused %s": [
    "Opětovné použití %s"
  ],
  "Root SSH public key": [
    "Veřejný klíč SSH pro roota"
  ],
  "Root authentication": [
    "Ověření superuživatele root"
  ],
  "Root password": [
    "Heslo roota"
  ],
  "SD Card": [
    "Karta SD"
  ],
  "SSH Key": [
    "Klíč SSH"
  ],
  "SSID": [
    "SSID"
  ],
  "Search": [
    "Hledat"
  ],
  "Security": [
    "Zabezpečení"
  ],
  "See more details": [
    "Zobrazit podrobnosti"
  ],
  "Select": [
    "Zvolit"
  ],
  "Select a disk": [
    "Výběr disku"
  ],
  "Select a location": [
    "Vyberte umístění"
  ],
  "Select a product": [
    "Vyberte produkt"
  ],
  "Select booting partition": [
    "Výběr zaváděcího oddílu"
  ],
  "Select how to allocate the file system": [
    "Zvolte způsob vytvoření souborového systému"
  ],
  "Select in which device to allocate the file system": [
    "Vyberte, ve kterém zařízení se má vytvořit systém souborů"
  ],
  "Select installation device": [
    "Výběr instalačního zařízení"
  ],
  "Select what to do with each partition.": [
    "Vyberte, co se má s jednotlivými oddíly dělat."
  ],
  "Selected patterns": [
    "Vybrané vzory"
  ],
  "Separate LVM at %s": [
    "Oddělené LVM na %s"
  ],
  "Server IP": [
    "IP adresa serveru"
  ],
  "Set": [
    "Nastavit"
  ],
  "Set DIAG Off": [
    "Vypnout DIAG"
  ],
  "Set DIAG On": [
    "Zapnout DIAG"
  ],
  "Set a password": [
    "Nastavte heslo"
  ],
  "Set a root password": [
    "Nastavte heslo roota"
  ],
  "Set root SSH public key": [
    "Nastavte veřejný klíč SSH pro roota"
  ],
  "Show %d subvolume action": [
    "Zobrazit %d akci podsvazku",
    "Zobrazit %d akce podsvazku",
    "Zobrazit %d akcí podsvazku"
  ],
  "Show information about %s": [
    "Zobrazit informace o %s"
  ],
  "Show partitions and file-systems actions": [
    "Zobrazení oddílů a akcí souborových systémů"
  ],
  "Shrink existing partitions": [
    "Zmenšit stávající oddíly"
  ],
  "Shrinking partitions is allowed": [
    "Zmenšování oddílů je povoleno"
  ],
  "Shrinking partitions is not allowed": [
    "Zmenšování oddílů není povoleno"
  ],
  "Shrinking some partitions is allowed but not needed": [
    "Zmenšení některých oddílů je povoleno, ale není nutné"
  ],
  "Size": [
    "Velikost"
  ],
  "Size unit": [
    "Jednotka velikosti"
  ],
  "Software": [
    "Software"
  ],
  "Software %s": [
    "Software %s"
  ],
  "Software selection": [
    "Výběr softwaru"
  ],
  "Something went wrong": [
    "Něco se nezdařilo"
  ],
  "Space policy": [
    "Zásady pro volné místo"
  ],
  "Startup": [
    "Typ startu iSCSI"
  ],
  "Status": [
    "Stav"
  ],
  "Storage": [
    "Úložiště"
  ],
  "Storage proposal not possible": [
    "Návrh úložiště není možný"
  ],
  "Structure of the new system, including any additional partition needed for booting": [
    "Struktura nového systému, včetně případných dalších oddílů potřebných pro zavádění systému"
  ],
  "Swap at %1$s (%2$s)": [
    "Přepnout na %1$s (%2$s)"
  ],
  "Swap partition (%s)": [
    "Přepnout oddíl (%s)"
  ],
  "Swap volume (%s)": [
    "Přepnout svazek (%s)"
  ],
  "TPM sealing requires the new system to be booted directly.": [
    "Zapečetění čipem TPM vyžaduje přímé spuštění nového systému."
  ],
  "Table with mount points": [
    "Tabulka s přípojnými body"
  ],
  "Take your time to check your configuration before starting the installation process.": [
    "Před zahájením instalace zkontrolujte konfiguraci."
  ],
  "Target Password": [
    "Cílové heslo"
  ],
  "Targets": [
    "Cíle"
  ],
  "The amount of RAM in the system": [
    "Množství paměti RAM v systému"
  ],
  "The configuration of snapshots": [
    "Konfigurace snímků"
  ],
  "The content may be deleted": [
    "Obsah může být smazán"
  ],
  "The current file system on %s is selected to be mounted at %s.": [
    "Aktuální souborový systém na %s je vybrán k připojení k %s."
  ],
  "The current file system on the selected device will be mounted   without formatting the device.": [
    "Aktuální souborový systém na vybraném zařízení bude připojen   bez formátování zařízení."
  ],
  "The data is kept, but the current partitions will be resized as needed.": [
    "Data zůstanou zachována, ale velikost aktuálních oddílů se podle potřeby změní."
  ],
  "The data is kept. Only the space not assigned to any partition will be used.": [
    "Data jsou uchována. Využije se pouze prostor, který není přiřazen žádnému oddílu."
  ],
  "The device cannot be shrunk:": [
    "Zařízení nelze zmenšit:"
  ],
  "The encryption password did not work": [
    "Zadané šifrovací heslo nefungovalo"
  ],
  "The file system is allocated at the device %s.": [
    "Souborový systém je přidělen na zařízení %s."
  ],
  "The file system will be allocated as a new partition at the selected   disk.": [
    "Souborový systém bude přidělen jako nový oddíl na vybraném   disku."
  ],
  "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
    "Souborové systémy jsou ve výchozím nastavení vytvořeny v instalačním zařízení. Chcete-li vytvořit souborový systém na konkrétním zařízení, zadejte vlastní umístění."
  ],
  "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
    "Souborové systémy budou ve výchozím nastavení přiděleny jako [logické svazky nové skupiny svazků LVM]. Odpovídající fyzické svazky budou na vyžádání vytvořeny jako nové oddíly na vybraných zařízeních."
  ],
  "The file systems will be allocated by default as [new partitions in the selected device].": [
    "Souborové systémy budou ve výchozím nastavení přiděleny jako [nové oddíly ve vybraném zařízení]."
  ],
  "The final size depends on %s.": [
    "Konečná velikost závisí na %s."
  ],
  "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
    "Poslední krok konfigurace modulu TPM (Trusted Platform Module) pro automatické otevírání šifrovaných zařízení se provede při prvním spuštění nového systému. Aby to fungovalo, musí se počítač spustit přímo novým zavaděčem."
  ],
  "The following software patterns are selected for installation:": [
    "Pro instalaci jsou vybrány tyto softwarové vzory:"
  ],
  "The installation on your machine is complete.": [
    "Instalace na váš počítač je dokončena."
  ],
  "The installation will take": [
    "Instalace zabere"
  ],
  "The installation will take %s including:": [
    "Instalace bude trvat %s včetně:"
  ],
  "The installer requires [root] user privileges.": [
    "Instalátor vyžaduje oprávnění uživatele [root]."
  ],
  "The mount point is invalid": [
    "Přípojný bod je neplatný"
  ],
  "The options for the file system type depends on the product and the mount point.": [
    "Možnosti typu souborového systému závisí na produktu a přípojném bodu."
  ],
  "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
    "Dokáže-li čip TPM ověřit integritu systému, nebude heslo pro spuštění systému a přístup k datům potřebné. Zapečetění TPM vyžaduje, aby byl nový systém spuštěn hned při prvním použití."
  ],
  "The selected device will be formatted as %s file system.": [
    "Vybrané zařízení bude formátováno jako souborový systém %s."
  ],
  "The size of the file system cannot be edited": [
    "Velikost souborového systému nelze měnit"
  ],
  "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
    "Systém nepodporuje připojení Wi-Fi, pravděpodobně chybí hardware nebo je zakázán."
  ],
  "The system has not been configured for connecting to a Wi-Fi network yet.": [
    "Systém zatím nebyl konfigurován pro připojení k síti Wi-Fi."
  ],
  "The system will use %s as its default language.": [
    "Systém použije jako výchozí jazyk %s."
  ],
  "The systems will be configured as displayed below.": [
    "Systémy budou konfigurovány tak, jak je zobrazeno níže."
  ],
  "The type and size of the file system cannot be edited.": [
    "Typ a velikost souborového systému nelze upravovat."
  ],
  "The zFCP disk was not activated.": [
    "Disk zFCP nebyl aktivován."
  ],
  "There is a predefined file system for %s.": [
    "Pro %s existuje předdefinovaný souborový systém."
  ],
  "There is already a file system for %s.": [
    "Pro %s již existuje souborový systém."
  ],
  "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
    "Toto je nejdůležitější nastavení instalace. Další podrobnosti najdete v sekcích v nabídce."
  ],
  "These limits are affected by:": [
    "Tyto limity jsou ovlivněny (čím):"
  ],
  "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
    "Tato akce zničí veškerá data uložená na níže uvedených zařízeních. Potvrďte prosím, že opravdu chcete pokračovat."
  ],
  "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
    "Tento produkt neumožňuje výběr softwarových vzorů během instalace. Po dokončení instalace však můžete přidat další software."
  ],
  "This space includes the base system and the selected software patterns, if any.": [
    "Tento prostor zahrnuje základní systém a vybrané softwarové vzory, pokud existují."
  ],
  "TiB": [
    "TiB"
  ],
  "Time zone": [
    "Časové pásmo"
  ],
  "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
    "Aby bylo možné nový systém spustit, může být nutné, aby instalační program vytvořil nebo nakonfiguroval některé oddíly na příslušném disku."
  ],
  "Transactional Btrfs": [
    "Transakční systém Btrfs"
  ],
  "Transactional Btrfs root partition (%s)": [
    "Transakční kořenový oddíl Btrfs (%s)"
  ],
  "Transactional Btrfs root volume (%s)": [
    "Transakční kořenový svazek Btrfs (%s)"
  ],
  "Transactional root file system": [
    "Transakční kořenový souborový systém"
  ],
  "Type": [
    "Typ"
  ],
  "Unit for the maximum size": [
    "Jednotka pro maximální velikost"
  ],
  "Unit for the minimum size": [
    "Jednotka pro minimální velikost"
  ],
  "Unselect": [
    "Zrušit výběr"
  ],
  "Unused space": [
    "Nevyužitý prostor"
  ],
  "Up to %s can be recovered by shrinking the device.": [
    "Zmenšením zařízení lze obnovit až %s."
  ],
  "Upload": [
    "Nahrát"
  ],
  "Upload a SSH Public Key": [
    "Nahrátí veřejného klíče SSH"
  ],
  "Upload, paste, or drop an SSH public key": [
    "Nahrání, vložení nebo přetažení veřejného klíče SSH"
  ],
  "Usage": [
    "Použití"
  ],
  "Use Btrfs snapshots for the root file system": [
    "Použití snímků Btrfs pro kořenový souborový systém"
  ],
  "Use available space": [
    "Využít dostupný prostor"
  ],
  "Use suggested username": [
    "Použijte navrhované uživatelské jméno"
  ],
  "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
    "Použití modulu TPM (Trusted Platform Module) k automatickému dešifrování při každém spuštění systému"
  ],
  "User full name": [
    "Celé jméno uživatele"
  ],
  "User name": [
    "Uživatelské jméno"
  ],
  "Username": [
    "Uživatelské jméno"
  ],
  "Username suggestion dropdown": [
    "Rozbalovací nabídka uživatelských jmen"
  ],
  "Users": [
    "Uživatelé"
  ],
  "Visible Wi-Fi networks": [
    "Viditelné sítě Wi-Fi"
  ],
  "WPA & WPA2 Personal": [
    "WPA & WPA2 Osobní"
  ],
  "WPA Password": [
    "Heslo WPA"
  ],
  "WWPN": [
    "WWPN"
  ],
  "Waiting": [
    "Čekám"
  ],
  "Waiting for actions information...": [
    "Čekáme na informace o akcích..."
  ],
  "Waiting for information about storage configuration": [
    "Čekání na informace o konfiguraci úložiště"
  ],
  "Wi-Fi": [
    "Wi-Fi"
  ],
  "WiFi connection form": [
    "Formulář pro připojení WiFi"
  ],
  "Wired": [
    "Připojení kabelem"
  ],
  "Wires: %s": [
    "Kabely: %s"
  ],
  "Yes": [
    "Ano"
  ],
  "ZFCP": [
    "ZFCP"
  ],
  "affecting": [
    "ovlivňující"
  ],
  "at least %s": [
    "alespoň %s"
  ],
  "auto": [
    "auto"
  ],
  "auto selected": [
    "automaticky vybráno"
  ],
  "configured": [
    "konfigurováno"
  ],
  "deleting current content": [
    "odstranění aktuálního obsahu"
  ],
  "disabled": [
    "odpojeno"
  ],
  "enabled": [
    "zapojeno"
  ],
  "iBFT": [
    "iBFT"
  ],
  "iSCSI": [
    "iSCSI"
  ],
  "shrinking partitions": [
    "zmenšování oddílů"
  ],
  "storage techs": [
    "technologie úložiště"
  ],
  "the amount of RAM in the system": [
    "velikost paměti RAM v systému"
  ],
  "the configuration of snapshots": [
    "konfigurace snímků"
  ],
  "the presence of the file system for %s": [
    "přítomnost souborového systému pro %s"
  ],
  "user autologin": [
    "automatické přihlášení uživatele"
  ],
  "using TPM unlocking": [
    "odemykání čipem TPM"
  ],
  "with custom actions": [
    "s vlastními akcemi"
  ],
  "without modifying any partition": [
    "bez úpravy jakéhokoli oddílu"
  ],
  "zFCP": [
    "zFCP"
  ],
  "zFCP Disk Activation": [
    "Aktivace disku zFCP"
  ],
  "zFCP Disk activation form": [
    "Aktivační formulář zFCP disku"
  ]
});
