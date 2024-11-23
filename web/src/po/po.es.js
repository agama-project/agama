import agama from "../agama";

agama.locale({
  "": {
    "plural-forms": (n) => n != 1,
    "language": "es"
  },
  " Timezone selection": [
    " Selección de zona horaria"
  ],
  " and ": [
    " y "
  ],
  "%1$s %2$s at %3$s (%4$s)": [
    "%1$s %2$s en %3$s (%4$s)"
  ],
  "%1$s %2$s partition (%3$s)": [
    "%1$s partición %2$s (%3$s)"
  ],
  "%1$s %2$s volume (%3$s)": [
    "%1$s %2$s volumen (%3$s)"
  ],
  "%1$s root at %2$s (%3$s)": [
    "%1$s raíz en %2$s (%3$s)"
  ],
  "%1$s root partition (%2$s)": [
    "%1$s partición raíz (%2$s)"
  ],
  "%1$s root volume (%2$s)": [
    "%1$s volumen raíz (%2$s)"
  ],
  "%d partition will be shrunk": [
    "%d partición se reducirá",
    "%d particiones se reducirán"
  ],
  "%s disk": [
    "disco %s"
  ],
  "%s is an immutable system with atomic updates. It uses a read-only Btrfs file system updated via snapshots.": [
    "%s es un sistema inmutable con actualizaciones atómicas. Utiliza un sistema de archivos Btrfs de solo lectura actualizado mediante instantáneas."
  ],
  "%s logo": [
    "logo %s"
  ],
  "%s with %d partitions": [
    "%s con %d particiones"
  ],
  ", ": [
    ", "
  ],
  "A mount point is required": [
    "Se requiere un punto de montaje"
  ],
  "A new LVM Volume Group": [
    "Un nuevo Grupo de Volúmen LVM"
  ],
  "A new volume group will be allocated in the selected disk and the   file system will be created as a logical volume.": [
    "Se asignará un nuevo grupo de volúmenes en el disco seleccionado y el sistema de archivos se creará como un volumen lógico."
  ],
  "A size value is required": [
    "Se requiere un valor de tamaño"
  ],
  "Accept": [
    "Aceptar"
  ],
  "Action": [
    "Acción"
  ],
  "Actions": [
    "Acciones"
  ],
  "Actions for connection %s": [
    "Acciones para la conexión %s"
  ],
  "Actions to find space": [
    "Acciones para encontrar espacio"
  ],
  "Activate": [
    "Activar"
  ],
  "Activate disks": [
    "Activar discos"
  ],
  "Activate new disk": [
    "Activar nuevo disco"
  ],
  "Activate zFCP disk": [
    "Activar disco zFCP"
  ],
  "Activated": [
    "Activado"
  ],
  "Add %s file system": [
    "Agregar %s sistema de archivos"
  ],
  "Add DNS": [
    "Añadir DNS"
  ],
  "Add a SSH Public Key for root": [
    "Añadir una clave pública SSH para root"
  ],
  "Add an address": [
    "Añadir una dirección"
  ],
  "Add another DNS": [
    "Añadir otro DNS"
  ],
  "Add another address": [
    "Añadir otras direcciones"
  ],
  "Add file system": [
    "Agregar sistema de archivos"
  ],
  "Address": [
    "Dirección"
  ],
  "Addresses": [
    "Direcciones"
  ],
  "Addresses data list": [
    "Lista de datos de direcciones"
  ],
  "All fields are required": [
    "Todos los campos son obligatorios"
  ],
  "All partitions will be removed and any data in the disks will be lost.": [
    "Se eliminarán todas las particiones y se perderán todos los datos de los discos."
  ],
  "Allows to boot to a previous version of the system after configuration changes or software upgrades.": [
    "Permitir iniciar una versión anterior del sistema después de cambios de configuración o actualizaciones de software."
  ],
  "Already set": [
    "Ya establecida"
  ],
  "An existing disk": [
    "Un disco existente"
  ],
  "At least one address must be provided for selected mode": [
    "Se debe proporcionar al menos una dirección para el modo seleccionado"
  ],
  "At this point you can power off the machine.": [
    "En este punto puede apagar el equipo."
  ],
  "At this point you can reboot the machine to log in to the new system.": [
    "En este punto, puede reiniciar el equipo para iniciar sesión en el nuevo sistema."
  ],
  "Authentication by initiator": [
    "Autenticación por iniciador"
  ],
  "Authentication by target": [
    "Autenticación por objetivo"
  ],
  "Authentication failed, please try again": [
    "Error de autenticación, inténtelo de nuevo"
  ],
  "Auto": [
    "Automático"
  ],
  "Auto LUNs Scan": [
    "Escaneo automático de LUN"
  ],
  "Auto-login": [
    "Inicio de sesión automático"
  ],
  "Automatic": [
    "Automático"
  ],
  "Automatic (DHCP)": [
    "Automático (DHCP)"
  ],
  "Automatic LUN scan is [disabled]. LUNs have to be manually       configured after activating a controller.": [
    "La exploración automática de LUN está [deshabilitada]. Los LUN deben configurarse manualmente después de activar un controlador."
  ],
  "Automatic LUN scan is [enabled]. Activating a controller which is       running in NPIV mode will automatically configures all its LUNs.": [
    "La exploración automática de LUN está [habilitada]. La activación de un controlador que se ejecuta en modo NPIV configurará automáticamente todos sus LUN."
  ],
  "Automatically calculated size according to the selected product.": [
    "Tamaño calculado automáticamente según el producto seleccionado."
  ],
  "Available products": [
    "Productos disponibles"
  ],
  "Back": [
    "Retroceder"
  ],
  "Back to device selection": [
    "Volver a la selección de dispositivos"
  ],
  "Before %s": [
    "Antes %s"
  ],
  "Before installing, please check the following problems.": [
    "Antes de instalar, verifique los siguientes problemas."
  ],
  "Before starting the installation, you need to address the following problems:": [
    "Antes de comenzar la instalación, debe solucionar los siguientes problemas:"
  ],
  "Boot partitions at %s": [
    "Arrancar particiones en %s"
  ],
  "Boot partitions at installation disk": [
    "Particiones de arranque en el disco de instalación"
  ],
  "Btrfs root partition with snapshots (%s)": [
    "Partición raíz Btrfs con instantáneas (%s)"
  ],
  "Btrfs root volume with snapshots (%s)": [
    "Volumen raíz Btrfs con instantáneas (%s)"
  ],
  "Btrfs with snapshots": [
    "Brtfs con instantáneas"
  ],
  "Cancel": [
    "Cancelar"
  ],
  "Cannot accommodate the required file systems for installation": [
    "No se pueden acomodar los sistemas de archivos necesarios para la instalación"
  ],
  "Cannot be changed in remote installation": [
    "No se puede cambiar en instalación remota"
  ],
  "Cannot connect to Agama server": [
    "No se pud conectar al servidor de Agama"
  ],
  "Cannot format all selected devices": [
    "No se pueden formatear todos los dispositivos seleccionados"
  ],
  "Change": [
    "Cambiar"
  ],
  "Change boot options": [
    "Cambiar opciones de arranque"
  ],
  "Change location": [
    "Cambiar ubicación"
  ],
  "Change product": [
    "Cambiar de producto"
  ],
  "Change selection": [
    "Cambiar selección"
  ],
  "Change the root password": [
    "Cambiar la contraseña de root"
  ],
  "Channel ID": [
    "Canal ID"
  ],
  "Check the planned action": [
    "Comprueba la acción planeada",
    "Comprueba las %d acciones planeadas"
  ],
  "Choose a disk for placing the boot loader": [
    "Escoger un disco para colocar el cargador de arranque"
  ],
  "Clear": [
    "Limpiar"
  ],
  "Close": [
    "Cerrar"
  ],
  "Configuring the product, please wait ...": [
    "Configurando el producto, por favor espere..."
  ],
  "Confirm": [
    "Confirmar"
  ],
  "Confirm Installation": [
    "Confirmar instalación"
  ],
  "Congratulations!": [
    "¡Felicidades!"
  ],
  "Connect": [
    "Conectar"
  ],
  "Connect to a Wi-Fi network": [
    "Conectado a una red WIFI"
  ],
  "Connect to hidden network": [
    "Conectar a una red oculta"
  ],
  "Connect to iSCSI targets": [
    "Conectar a objetivos iSCSI"
  ],
  "Connected": [
    "Conectado"
  ],
  "Connected (%s)": [
    "Conectado (%s)"
  ],
  "Connected to %s": [
    "Conectado a %s"
  ],
  "Connecting": [
    "Conectando"
  ],
  "Connection actions": [
    "Acciones de conexión"
  ],
  "Continue": [
    "Continuar"
  ],
  "Controllers": [
    "Controladores"
  ],
  "Could not authenticate against the server, please check it.": [
    "No se pudo autenticar en el servidor, por favor verifíquelo."
  ],
  "Could not log in. Please, make sure that the password is correct.": [
    "No se ha podido iniciar sesión. Por favor, asegúrese de que la contraseña es correcta."
  ],
  "Create a dedicated LVM volume group": [
    "Crear un grupo de volúmenes LVM dedicado"
  ],
  "Create a new partition": [
    "Crear una nueva partición"
  ],
  "Create user": [
    "Crear usuario"
  ],
  "Custom": [
    "Personalizado"
  ],
  "DASD": [
    "DASD"
  ],
  "DASD %s": [
    "DASD %s"
  ],
  "DASD devices selection table": [
    "Tabla de selección de dispositivos DASD"
  ],
  "DASDs table section": [
    "sección de tabla DASDs"
  ],
  "DIAG": [
    "DIAG"
  ],
  "DNS": [
    "DNS"
  ],
  "Deactivate": [
    "Desactivar"
  ],
  "Deactivated": [
    "Desactivado"
  ],
  "Define a user now": [
    "Definir un usuario ahora"
  ],
  "Delete": [
    "Eliminar"
  ],
  "Delete current content": [
    "Eliminar el contenido actual"
  ],
  "Destructive actions are allowed": [
    "Se permiten acciones destructivas"
  ],
  "Destructive actions are not allowed": [
    "No se permiten acciones destructivas"
  ],
  "Details": [
    "Detalles"
  ],
  "Device": [
    "Dispositivo"
  ],
  "Device selector for new LVM volume group": [
    "Selector de dispositivo para nuevo grupo de volúmenes LVM"
  ],
  "Device selector for target disk": [
    "Selector de dispositivo para disco de destino"
  ],
  "Devices: %s": [
    "Dispositivos: %s"
  ],
  "Discard": [
    "Descartar"
  ],
  "Disconnect": [
    "Desconectar"
  ],
  "Disconnected": [
    "Desconectado"
  ],
  "Discover": [
    "Descubrir"
  ],
  "Discover iSCSI Targets": [
    "Descubrir los objetivos iSCSI"
  ],
  "Discover iSCSI targets": [
    "Descubrir objetivos iSCSI"
  ],
  "Disk": [
    "Disco"
  ],
  "Disks": [
    "Discos"
  ],
  "Do not configure": [
    "No configurar"
  ],
  "Do not configure partitions for booting": [
    "No configurar particiones para el arranque"
  ],
  "Do you want to add it?": [
    "¿Quieres añadirlo?"
  ],
  "Do you want to edit it?": [
    "¿Quieres editarlo?"
  ],
  "Download logs": [
    "Descargar los registros"
  ],
  "Edit": [
    "Editar"
  ],
  "Edit %s": [
    "Editar %s"
  ],
  "Edit %s file system": [
    "Editar %s sistema de archivos"
  ],
  "Edit connection %s": [
    "Editar conexión %s"
  ],
  "Edit file system": [
    "Editar sistema de archivos"
  ],
  "Edit iSCSI Initiator": [
    "Editar iniciador iSCSI"
  ],
  "Edit password too": [
    "Editar contraseña también"
  ],
  "Edit the SSH Public Key for root": [
    "Editar la clave pública SSH para root"
  ],
  "Edit user": [
    "Editar usuario"
  ],
  "Enable": [
    "Habilitado"
  ],
  "Encrypt the system": [
    "Cifrar el sistema"
  ],
  "Encrypted Device": [
    "Dispositivo cifrado"
  ],
  "Encryption": [
    "Cifrado"
  ],
  "Encryption Password": [
    "Contraseña de cifrado"
  ],
  "Exact size": [
    "Tamaño exacto"
  ],
  "Exact size for the file system.": [
    "Tamaño exacto para el sistema de archivos."
  ],
  "File system type": [
    "Tipo de sistema de archivos"
  ],
  "File systems created as new partitions at %s": [
    "Sistemas de archivos creados como particiones nuevas en %s"
  ],
  "File systems created at a new LVM volume group": [
    "Sistemas de archivos creados en un nuevo grupo de volúmenes LVM"
  ],
  "File systems created at a new LVM volume group on %s": [
    "Sistemas de archivos creados en un nuevo grupo de volúmenes LVM en %s"
  ],
  "Filter by description or keymap code": [
    "Filtrar por descripción o código de mapa de teclas"
  ],
  "Filter by language, territory or locale code": [
    "Filtrar por idioma, territorio o código local"
  ],
  "Filter by max channel": [
    "Filtrar por canal máximo"
  ],
  "Filter by min channel": [
    "Filtrar por canal mínimo"
  ],
  "Filter by pattern title or description": [
    "Filtrar por título o descripción del patrón"
  ],
  "Filter by territory, time zone code or UTC offset": [
    "Filtrar por territorio, código de zona horaria o compensación UTC"
  ],
  "Final layout": [
    "Diseño final"
  ],
  "Finish": [
    "Finalizar"
  ],
  "Finished": [
    "Finalizado"
  ],
  "First user": [
    "Primer usuario"
  ],
  "Fixed": [
    "Fijado"
  ],
  "Forget": [
    "Olvidar"
  ],
  "Forget connection %s": [
    "Olvidar conexión %s"
  ],
  "Format": [
    "Formatear"
  ],
  "Format selected devices?": [
    "¿Formatear los dispositivos seleccionados?"
  ],
  "Format the device": [
    "Formatear el dispositivo"
  ],
  "Formatted": [
    "Formateado"
  ],
  "Formatting DASD devices": [
    "Formatear dispositivos DASD"
  ],
  "Full Disk Encryption (FDE) allows to protect the information stored at the device, including data, programs, and system files.": [
    "Full Disk Encryption (FDE) permite proteger la información almacenada en el dispositivo, incluidos datos, programas y archivos del sistema."
  ],
  "Full name": [
    "Nombre completo"
  ],
  "Gateway": [
    "Puerta de enlace"
  ],
  "Gateway can be defined only in 'Manual' mode": [
    "La puerta de enlace sólo se puede definir en modo 'Manual'"
  ],
  "GiB": [
    "GB"
  ],
  "Hide %d subvolume action": [
    "Ocultar %d acción de subvolumen",
    "Ocultar %d acciones de subvolumen"
  ],
  "Hide details": [
    "Ocultar detalles"
  ],
  "IP Address": [
    "Dirección IP"
  ],
  "IP address": [
    "Dirección IP"
  ],
  "IP addresses": [
    "Direcciones IP"
  ],
  "If a local media was used to run this installer, remove it before the next boot.": [
    "Si se utilizó un medio local para ejecutar este instalador, expúlselo antes del próximo inicio."
  ],
  "If you continue, partitions on your hard disk will be modified according to the provided installation settings.": [
    "Si continúa, las particiones de su disco duro se modificarán de acuerdo con la configuración de instalación proporcionada."
  ],
  "In progress": [
    "En progreso"
  ],
  "Incorrect IP address": [
    "Dirección IP incorrecta"
  ],
  "Incorrect password": [
    "Contraseña incorrecta"
  ],
  "Incorrect port": [
    "Puerto incorrecto"
  ],
  "Incorrect user name": [
    "Nombre de usuario incorrecto"
  ],
  "Initiator": [
    "Iniciador"
  ],
  "Initiator name": [
    "Nombre del iniciador"
  ],
  "Install": [
    "Instalar"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group deleting all the content of the underlying devices": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) elimina todo el contenido de los dispositivos subyacentes"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s deleting all its content": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) en %s eliminando todo su contenido"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s shrinking existing partitions as needed": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) en %s, reduciendo las particiones existentes según sea necesario"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s using a custom strategy to find the needed space": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) en %s usando una estrategia personalizada para encontrar el espacio necesario"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group on %s without modifying existing partitions": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) en %s sin modificar las particiones existentes"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group shrinking existing partitions at the underlying devices as needed": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) reduciendo las particiones existentes en los dispositivos subyacentes según sea necesario"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group using a custom strategy to find the needed space at the underlying devices": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) utilizando una estrategia personalizada para encontrar el espacio necesario en los dispositivos subyacentes"
  ],
  "Install in a new Logical Volume Manager (LVM) volume group without modifying the partitions at the underlying devices": [
    "Instalar en un nuevo grupo de volúmenes de Logical Volume Manager (LVM) sin modificar las particiones en los dispositivos subyacentes"
  ],
  "Install new system on": [
    "Instalar nuevo sistema en"
  ],
  "Install using device %s and deleting all its content": [
    "Instalar utilizando el dispositivo %s y eliminar todo su contenido"
  ],
  "Install using device %s shrinking existing partitions as needed": [
    "Instalar utilizando el dispositivo %s reduciendo las particiones existentes según sea necesario"
  ],
  "Install using device %s with a custom strategy to find the needed space": [
    "Instalar usando el dispositivo %s con una estrategia personalizada para encontrar el espacio necesario"
  ],
  "Install using device %s without modifying existing partitions": [
    "Instalar utilizando el dispositivo %s sin modificar las particiones existentes"
  ],
  "Installation blocking issues": [
    "Problemas bloqueando la instalación"
  ],
  "Installation device": [
    "Dispositivo de instalación"
  ],
  "Installation issues": [
    "Problemas en la instalación"
  ],
  "Installation not possible yet because of issues. Check them at Overview page.": [
    "Aún no es posible la instalación debido a problemas. Verifíquelos en la página de Descripción general."
  ],
  "Installation will configure partitions for booting at %s.": [
    "La instalación configurará las particiones para arrancar en %s."
  ],
  "Installation will configure partitions for booting at the installation disk.": [
    "La instalación configurará las particiones para arrancar en el disco de instalación."
  ],
  "Installation will not configure partitions for booting.": [
    "La instalación no configurará particiones para el arranque."
  ],
  "Installation will take %s.": [
    "La instalación ocupará %s."
  ],
  "Installer Options": [
    "Opciones del Instalador"
  ],
  "Installer options": [
    "Opciones del instalador"
  ],
  "Installing the system, please wait...": [
    "Instalando el sistema, espere por favor..."
  ],
  "Interface": [
    "Interfaz"
  ],
  "Ip prefix or netmask": [
    "Prefijo IP o máscara de red"
  ],
  "Keyboard": [
    "Teclado"
  ],
  "Keyboard layout": [
    "Esquema del teclado"
  ],
  "Keyboard selection": [
    "Selección de teclado"
  ],
  "KiB": [
    "KB"
  ],
  "LUN": [
    "LUN"
  ],
  "Language": [
    "Idioma"
  ],
  "Limits for the file system size. The final size will be a value between the given minimum and maximum. If no maximum is given then the file system will be as big as possible.": [
    "Límites para el tamaño del sistema de archivos. El tamaño final será un valor entre el mínimo y el máximo dados. Si no se da un máximo, el sistema de archivos será lo más grande posible."
  ],
  "Loading data...": [
    "Cargando los datos..."
  ],
  "Loading installation environment, please wait.": [
    "Cargando el entorno de instalación, espere por favor."
  ],
  "Locale selection": [
    "Selección de configuración regional"
  ],
  "Localization": [
    "Localización"
  ],
  "Location": [
    "Ubicación"
  ],
  "Location for %s file system": [
    "Ubicación del sistema de archivos %s"
  ],
  "Log in": [
    "Iniciar sesión"
  ],
  "Log in as %s": [
    "Iniciar sesión como %s"
  ],
  "Logical volume at system LVM": [
    "Volumen lógico en el sistema LVM"
  ],
  "Login": [
    "Acceder"
  ],
  "Login %s": [
    "Iniciar sesión %s"
  ],
  "Login form": [
    "Formulario de inicio de sesión"
  ],
  "Logout": [
    "Cerrar sesión"
  ],
  "Main disk or LVM Volume Group for installation.": [
    "Disco principal o el grupo de volúmenes LVM para la instalación."
  ],
  "Main navigation": [
    "Navegación principal"
  ],
  "Make sure you provide the correct values": [
    "Asegúrese de proporcionar los valores correctos"
  ],
  "Manage and format": [
    "Administrar y formatear"
  ],
  "Manual": [
    "Manual"
  ],
  "Maximum": [
    "Máximo"
  ],
  "Maximum desired size": [
    "Tamaño máximo deseado"
  ],
  "Maximum must be greater than minimum": [
    "El máximo debe ser mayor que el mínimo"
  ],
  "Members: %s": [
    "Miembros: %s"
  ],
  "Method": [
    "Método"
  ],
  "MiB": [
    "MB"
  ],
  "Minimum": [
    "Mínimo"
  ],
  "Minimum desired size": [
    "Tamaño mínimo deseado"
  ],
  "Minimum size is required": [
    "Se requiere un tamaño mínimo"
  ],
  "Mode": [
    "Modo"
  ],
  "Modify": [
    "Modificar"
  ],
  "More info for file system types": [
    "Más información para los tipos de sistemas de archivos"
  ],
  "Mount %1$s at %2$s (%3$s)": [
    "Montar %1$s en %2$s (%3$s)"
  ],
  "Mount Point": [
    "Punto de montaje"
  ],
  "Mount point": [
    "Punto de montaje"
  ],
  "Mount the file system": [
    "Montar el sistema de archivos"
  ],
  "Multipath": [
    "Ruta múltiple"
  ],
  "Name": [
    "Nombre"
  ],
  "Network": [
    "Red"
  ],
  "New": [
    "Nuevo"
  ],
  "No": [
    "No"
  ],
  "No Wi-Fi supported": [
    "Wi-Fi no admitida"
  ],
  "No additional software was selected.": [
    "No se seleccionó software adicional."
  ],
  "No connected yet": [
    "Aún no conectado"
  ],
  "No content found": [
    "No se encontró contenido"
  ],
  "No device selected yet": [
    "Ningún dispositivo seleccionado todavía"
  ],
  "No iSCSI targets found.": [
    "No se encontraron objetivos iSCSI."
  ],
  "No partitions will be automatically configured for booting. Use with caution.": [
    "No se configurarán particiones automáticamente para el arranque. Úselo con precaución."
  ],
  "No root authentication method defined yet.": [
    "Aún no se ha definido ningún método de autenticación de root."
  ],
  "No user defined yet.": [
    "Ningún usuario definido todavía."
  ],
  "No visible Wi-Fi networks found": [
    "No se encontraron redes Wi-Fi visibles"
  ],
  "No wired connections found": [
    "No se encontraron conexiones por cable"
  ],
  "No zFCP controllers found.": [
    "No se encontraron controladores zFCP."
  ],
  "No zFCP disks found.": [
    "No se encontraron discos zFCP."
  ],
  "None": [
    "Ninguno"
  ],
  "None of the keymaps match the filter.": [
    "Ninguno de los mapas de teclas coincide con el filtro."
  ],
  "None of the locales match the filter.": [
    "Ninguna de las configuraciones regionales coincide con el filtro."
  ],
  "None of the patterns match the filter.": [
    "Ninguno de los patrones coincide con el filtro."
  ],
  "None of the time zones match the filter.": [
    "Ninguna de las zonas horarias coincide con el filtro."
  ],
  "Not selected yet": [
    "Aún no seleccionado"
  ],
  "Not set": [
    "No establecida"
  ],
  "Offline devices must be activated before formatting them. Please, unselect or activate the devices listed below and try it again": [
    "Los dispositivos sin conexión deben activarse antes de ser formateados. Por favor deseleccione o active los dispositivos listados debajo y trate nuevamente"
  ],
  "Offload card": [
    "Descargar tarjeta"
  ],
  "On boot": [
    "En arranque"
  ],
  "Only available if authentication by target is provided": [
    "Solo disponible si se proporciona autenticación por destino"
  ],
  "Options toggle": [
    "Conmutador de opciones"
  ],
  "Other": [
    "Otro"
  ],
  "Overview": [
    "Descripción general"
  ],
  "Partition Info": [
    "Información de la partición"
  ],
  "Partition at %s": [
    "Partición en %s"
  ],
  "Partition at installation disk": [
    "Partición en el disco de instalación"
  ],
  "Partitions and file systems": [
    "Particiones y sistemas de archivos"
  ],
  "Partitions to boot will be allocated at the following device.": [
    "Las particiones para arrancar se asignarán en el siguiente dispositivo."
  ],
  "Partitions to boot will be allocated at the installation disk (%s).": [
    "Las particiones para arrancar se asignarán en el disco de instalación (%s)."
  ],
  "Partitions to boot will be allocated at the installation disk.": [
    "Las particiones para arrancar se asignarán en el disco de instalación."
  ],
  "Password": [
    "Contraseña"
  ],
  "Password Required": [
    "Se requiere contraseña"
  ],
  "Password confirmation": [
    "Confirmación de contraseña"
  ],
  "Password input": [
    "Entrada de contraseña"
  ],
  "Password visibility button": [
    "Botón de visibilidad de contraseña"
  ],
  "Passwords do not match": [
    "Las contraseñas no coinciden"
  ],
  "Pending": [
    "Pendiente"
  ],
  "Perform an action": [
    "Realizar una acción"
  ],
  "PiB": [
    "PB"
  ],
  "Planned Actions": [
    "Acciones planeadas"
  ],
  "Please, be aware that a user must be defined before installing the system to be able to log into it.": [
    "Tenga en cuenta que se debe definir un usuario antes de instalar el sistema para poder iniciar sesión en él."
  ],
  "Please, cancel and check the settings if you are unsure.": [
    "Por favor, cancele y verifique la configuración si no está seguro."
  ],
  "Please, check whether it is running.": [
    "Por favor, compruebe si está funcionando."
  ],
  "Please, define at least one authentication method for logging into the system as root.": [
    "Por favor, defina al menos un método de autenticación para iniciar sesión en el sistema como root."
  ],
  "Please, perform an iSCSI discovery in order to find available iSCSI targets.": [
    "Realice una exploación de iSCSI para encontrar objetivos iSCSI disponibles."
  ],
  "Please, provide its password to log in to the system.": [
    "Por favor, proporcione su contraseña para iniciar sesión en el sistema."
  ],
  "Please, review provided settings and try again.": [
    "Por favor, revise la configuración proporcionada y vuelva a intentarlo."
  ],
  "Please, try to activate a zFCP controller.": [
    "Por favor, intente activar un controlador zFCP."
  ],
  "Please, try to activate a zFCP disk.": [
    "Por favor, intente activar un disco zFCP."
  ],
  "Port": [
    "Puerto"
  ],
  "Portal": [
    "Portal"
  ],
  "Prefix length or netmask": [
    "Longitud del prefijo o máscara de red"
  ],
  "Prepare more devices by configuring advanced": [
    "Preparar más dispositivos configurando de forma avanzada"
  ],
  "Presence of other volumes (%s)": [
    "Presencia de otros volúmenes (%s)"
  ],
  "Protection for the information stored at the device, including data, programs, and system files.": [
    "Protección de la información almacenada en el dispositivo, incluidos datos, programas y archivos del sistema."
  ],
  "Question": [
    "Pregunta"
  ],
  "Range": [
    "Rango"
  ],
  "Read zFCP devices": [
    "Leer dispositivos zFCP"
  ],
  "Reboot": [
    "Reiniciar"
  ],
  "Reload": [
    "Recargar"
  ],
  "Remove": [
    "Eliminar"
  ],
  "Remove max channel filter": [
    "Eliminar filtro de canal máximo"
  ],
  "Remove min channel filter": [
    "Eliminar filtro de canal mínimo"
  ],
  "Reset location": [
    "Reiniciar localización"
  ],
  "Reset to defaults": [
    "Restablecer los valores predeterminados"
  ],
  "Reused %s": [
    "Reutilizado %s"
  ],
  "Root SSH public key": [
    "Clave pública SSH de root"
  ],
  "Root authentication": [
    "Autenticación de root"
  ],
  "Root password": [
    "Contraseña de root"
  ],
  "SD Card": [
    "Tarjeta SD"
  ],
  "SSH Key": [
    "Clave SSH"
  ],
  "SSID": [
    "SSID"
  ],
  "Search": [
    "Buscar"
  ],
  "Security": [
    "Seguridad"
  ],
  "See more details": [
    "Ver más detalles"
  ],
  "Select": [
    "Seleccionar"
  ],
  "Select a disk": [
    "Seleccionar un disco"
  ],
  "Select a location": [
    "Seleccionar una ubicación"
  ],
  "Select a product": [
    "Seleccionar un producto"
  ],
  "Select booting partition": [
    "Seleccion la partición de arranque"
  ],
  "Select how to allocate the file system": [
    "Seleccionar cómo asignar el sistema de archivos"
  ],
  "Select in which device to allocate the file system": [
    "Seleccione en qué dispositivo asignar el sistema de archivos"
  ],
  "Select installation device": [
    "Seleccionar el dispositivo de instalación"
  ],
  "Select what to do with each partition.": [
    "Seleccione qué hacer con cada partición."
  ],
  "Selected patterns": [
    "Seleccione los patrones"
  ],
  "Separate LVM at %s": [
    "Separar LVM en %s"
  ],
  "Server IP": [
    "Servidor IP"
  ],
  "Set": [
    "Establecer"
  ],
  "Set DIAG Off": [
    "Desactivar DIAG"
  ],
  "Set DIAG On": [
    "Activar DIAG"
  ],
  "Set a password": [
    "Establecer una contraseña"
  ],
  "Set a root password": [
    "Establecer una contraseña de root"
  ],
  "Set root SSH public key": [
    "Establecer clave pública SSH de root"
  ],
  "Show %d subvolume action": [
    "Mostrar %d acción de subvolumen",
    "Mostrar %d acciones de subvolumen"
  ],
  "Show information about %s": [
    "Mostrar información sobre %s"
  ],
  "Show partitions and file-systems actions": [
    "Mostrar acciones de particiones y sistemas de archivos"
  ],
  "Shrink existing partitions": [
    "Reducir las particiones existentes"
  ],
  "Shrinking partitions is allowed": [
    "Se permite reducir las particiones existentes"
  ],
  "Shrinking partitions is not allowed": [
    "No se permite reducir las particiones existentes"
  ],
  "Shrinking some partitions is allowed but not needed": [
    "Se permite reducir algunas particiones, pero no es necesario"
  ],
  "Size": [
    "Tamaño"
  ],
  "Size unit": [
    "Unidad de tamaño"
  ],
  "Software": [
    "Software"
  ],
  "Software %s": [
    "Software %s"
  ],
  "Software selection": [
    "Selección de software"
  ],
  "Something went wrong": [
    "Algo salió mal"
  ],
  "Space policy": [
    "Política de espacio"
  ],
  "Startup": [
    "Puesta en marcha"
  ],
  "Status": [
    "Estado"
  ],
  "Storage": [
    "Almacenamiento"
  ],
  "Storage proposal not possible": [
    "Propuesta de almacenamiento no posible"
  ],
  "Structure of the new system, including any additional partition needed for booting": [
    "Estructura del nuevo sistema, incluida cualquier partición adicional necesaria para el arranque"
  ],
  "Swap at %1$s (%2$s)": [
    "Intercambiar en %1$s (%2$s)"
  ],
  "Swap partition (%s)": [
    "Partición de intercambio (%s)"
  ],
  "Swap volume (%s)": [
    "Volumen de intercambio (%s)"
  ],
  "TPM sealing requires the new system to be booted directly.": [
    "El sellado TPM requiere que el nuevo sistema se inicie directamente."
  ],
  "Table with mount points": [
    "Tabla con puntos de montaje"
  ],
  "Take your time to check your configuration before starting the installation process.": [
    "Dedica un tiempo para verificar la configuración antes de iniciar el proceso de instalación."
  ],
  "Target Password": [
    "Contraseña de destino"
  ],
  "Targets": [
    "Objetivos"
  ],
  "The amount of RAM in the system": [
    "La cantidad de memoria RAM en el sistema"
  ],
  "The configuration of snapshots": [
    "La configuración de instantáneas"
  ],
  "The content may be deleted": [
    "El contenido puede ser eliminado"
  ],
  "The current file system on %s is selected to be mounted at %s.": [
    "El actual sistema de archivos en %s está seleccionado para ser montado en %s."
  ],
  "The current file system on the selected device will be mounted   without formatting the device.": [
    "El actual sistema de archivos en el dispositivo seleccionado se montará sin formatear el dispositivo."
  ],
  "The data is kept, but the current partitions will be resized as needed.": [
    "Los datos se conservan, pero las particiones actuales cambiarán de tamaño según sea necesario."
  ],
  "The data is kept. Only the space not assigned to any partition will be used.": [
    "Los datos se conservan. Sólo se utilizará el espacio que no esté asignado a ninguna partición."
  ],
  "The device cannot be shrunk:": [
    "El dispositivo no se puede reducir:"
  ],
  "The encryption password did not work": [
    "La contraseña de cifrado no funcionó"
  ],
  "The file system is allocated at the device %s.": [
    "El sistema de archivos está asignado en el dispositivo %s."
  ],
  "The file system will be allocated as a new partition at the selected   disk.": [
    "El sistema de archivos se asignará como una nueva partición en el disco seleccionado."
  ],
  "The file systems are allocated at the installation device by default. Indicate a custom location to create the file system at a specific device.": [
    "Los sistemas de archivos son asignados por defecto en el dispositivo de instalación. Indique una ubicación personalizada para crear el sistema de archivos en un dispositivo específico."
  ],
  "The file systems will be allocated by default as [logical volumes of a new LVM Volume Group]. The corresponding physical volumes will be created on demand as new partitions at the selected devices.": [
    "Los sistemas de archivos se asignarán de forma predeterminada como [volúmenes lógicos de un nuevo grupo de volúmenes LVM]. Los volúmenes físicos correspondientes se crearán según demanda como nuevas particiones en los dispositivos seleccionados."
  ],
  "The file systems will be allocated by default as [new partitions in the selected device].": [
    "Los sistemas de archivos se asignarán de forma predeterminada como [nuevas particiones en el dispositivo seleccionado]."
  ],
  "The final size depends on %s.": [
    "El tamaño final depende de %s."
  ],
  "The final step to configure the Trusted Platform Module (TPM) to automatically open encrypted devices will take place during the first boot of the new system. For that to work, the machine needs to boot directly to the new boot loader.": [
    "El último paso para configurar Trusted Platform Module (TPM) para abrir automáticamente dispositivos cifrados se llevará a cabo durante el primer inicio del nuevo sistema. Para que eso funcione, la máquina debe iniciarse directamente en el nuevo gestor de arranque."
  ],
  "The following software patterns are selected for installation:": [
    "Los siguientes patrones de software están seleccionados para la instalación:"
  ],
  "The installation on your machine is complete.": [
    "La instalación en su equipo está completa."
  ],
  "The installation will take": [
    "La instalación ocupará"
  ],
  "The installation will take %s including:": [
    "La instalación ocupará %s incluyendo:"
  ],
  "The installer requires [root] user privileges.": [
    "El instalador requiere privilegios de usuario [root]."
  ],
  "The mount point is invalid": [
    "El punto de montaje no es válido"
  ],
  "The options for the file system type depends on the product and the mount point.": [
    "Las opciones para el tipo de sistema de archivos dependen del producto y del punto de montaje."
  ],
  "The password will not be needed to boot and access the data if the TPM can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.": [
    "La contraseña no será necesaria para iniciar y acceder a los datos si TPM puede verificar la integridad del sistema. El sellado TPM requiere que el nuevo sistema se inicie directamente en su primera ejecución."
  ],
  "The selected device will be formatted as %s file system.": [
    "El dispositivo seleccionado se formateará como un sistema de archivos %s."
  ],
  "The size of the file system cannot be edited": [
    "El tamaño del sistema de archivos no puede ser editado"
  ],
  "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.": [
    "El sistema no admite conexiones WiFi, probablemente debido a que falta hardware o está deshabilitado."
  ],
  "The system has not been configured for connecting to a Wi-Fi network yet.": [
    "El sistema aún no se ha configurado para conectarse a una red WiFi."
  ],
  "The system will use %s as its default language.": [
    "El sistema utilizará %s como su idioma predeterminado."
  ],
  "The systems will be configured as displayed below.": [
    "Los sistemas se configurarán como se muestra a continuación."
  ],
  "The type and size of the file system cannot be edited.": [
    "El tipo y el tamaño del sistema de archivos no puede ser editado."
  ],
  "The zFCP disk was not activated.": [
    "El disco zFCP no estaba activado."
  ],
  "There is a predefined file system for %s.": [
    "Hay un sistema de archivos predefinido para %s."
  ],
  "There is already a file system for %s.": [
    "Ya existe un sistema de archivos para %s."
  ],
  "These are the most relevant installation settings. Feel free to browse the sections in the menu for further details.": [
    "Estas son las configuraciones de instalación más relevantes. No dude en explorar las secciones del menú para obtener más detalles."
  ],
  "These limits are affected by:": [
    "Estos límites se ven afectados por:"
  ],
  "This action could destroy any data stored on the devices listed below. Please, confirm that you really want to continue.": [
    "Esta acción podría destruir cualquier dato almacenado en los dispositivos listados debajo. Por favor confirme que realmente desea continuar."
  ],
  "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.": [
    "Este producto no permite seleccionar patrones de software durante la instalación. Sin embargo, puede agregar software adicional una vez finalizada la instalación."
  ],
  "This space includes the base system and the selected software patterns, if any.": [
    "Este espacio incluye el sistema base y los patrones de software seleccionados, si los hubiera."
  ],
  "TiB": [
    "TB"
  ],
  "Time zone": [
    "Zona horaria"
  ],
  "To ensure the new system is able to boot, the installer may need to create or configure some partitions in the appropriate disk.": [
    "Para garantizar que el nuevo sistema pueda iniciarse, es posible que el instalador deba crear o configurar algunas particiones en el disco apropiado."
  ],
  "Transactional Btrfs": [
    "Transaccional Brtfs"
  ],
  "Transactional Btrfs root partition (%s)": [
    "Partición raíz transaccional Btrfs (%s)"
  ],
  "Transactional Btrfs root volume (%s)": [
    "Volumen raíz transaccional de Btrfs (%s)"
  ],
  "Transactional root file system": [
    "Sistema de archivos raíz transaccional"
  ],
  "Type": [
    "Tipo"
  ],
  "Unit for the maximum size": [
    "Unidad para el tamaño máximo"
  ],
  "Unit for the minimum size": [
    "Unidad para el tamaño mínimo"
  ],
  "Unselect": [
    "Deseleccionar"
  ],
  "Unused space": [
    "Espacio no utilizado"
  ],
  "Up to %s can be recovered by shrinking the device.": [
    "Se pueden recuperar hasta %s reduciendo el dispositivo."
  ],
  "Upload": [
    "Cargar"
  ],
  "Upload a SSH Public Key": [
    "Cargar una clave pública SSH"
  ],
  "Upload, paste, or drop an SSH public key": [
    "Cargar, pegar o arrastrar una clave pública SSH"
  ],
  "Usage": [
    "Uso"
  ],
  "Use Btrfs snapshots for the root file system": [
    "Utilizar instantáneas de Btrfs para el sistema de archivos raíz"
  ],
  "Use available space": [
    "Utilice el espacio disponible"
  ],
  "Use suggested username": [
    "Usar nombre de usuario sugerido"
  ],
  "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot": [
    "Utilizar Trusted Platform Module(TPM) para descifrar automáticamente en cada arranque"
  ],
  "User full name": [
    "Nombre completo del usuario"
  ],
  "User name": [
    "Nombre de usuario"
  ],
  "Username": [
    "Nombre de usuario"
  ],
  "Username suggestion dropdown": [
    "Menú desplegable de sugerencias de nombre de usuario"
  ],
  "Users": [
    "Usuarios"
  ],
  "Visible Wi-Fi networks": [
    "Redes WIFI visibles"
  ],
  "WPA & WPA2 Personal": [
    "WPA y WPA2 personales"
  ],
  "WPA Password": [
    "Contraseña WPA"
  ],
  "WWPN": [
    "WWPN"
  ],
  "Waiting": [
    "Esperar"
  ],
  "Waiting for actions information...": [
    "Esperando información de acciones..."
  ],
  "Waiting for information about storage configuration": [
    "Esperando información sobre la configuración de almacenamiento"
  ],
  "Wi-Fi": [
    "WiFi"
  ],
  "WiFi connection form": [
    "Formulario de conexión WiFi"
  ],
  "Wired": [
    "Cableada"
  ],
  "Wires: %s": [
    "Wires: %s"
  ],
  "Yes": [
    "Sí"
  ],
  "ZFCP": [
    "ZFCP"
  ],
  "affecting": [
    "afectados"
  ],
  "at least %s": [
    "al menos %s"
  ],
  "auto": [
    "automático"
  ],
  "auto selected": [
    "seleccionado automáticamente"
  ],
  "configured": [
    "Configurado"
  ],
  "deleting current content": [
    "eliminando el contenido actual"
  ],
  "disabled": [
    "desactivado"
  ],
  "enabled": [
    "activado"
  ],
  "iBFT": [
    "iBFT"
  ],
  "iSCSI": [
    "iSCSI"
  ],
  "shrinking partitions": [
    "reduciendo las particiones"
  ],
  "storage techs": [
    "tecnologías de almacenamiento"
  ],
  "the amount of RAM in the system": [
    "la cantidad de memoria RAM en el sistema"
  ],
  "the configuration of snapshots": [
    "la configuración de las instantáneas"
  ],
  "the presence of the file system for %s": [
    "la presencia del sistema de archivos para %s"
  ],
  "user autologin": [
    "inicio de sesión automático del usuario"
  ],
  "using TPM unlocking": [
    "usando el desbloqueo TPM"
  ],
  "with custom actions": [
    "con acciones personalizadas"
  ],
  "without modifying any partition": [
    "sin modificar ninguna partición"
  ],
  "zFCP": [
    "zFCP"
  ],
  "zFCP Disk Activation": [
    "Activación del disco zFCP"
  ],
  "zFCP Disk activation form": [
    "Formulario de activación del disco zFCP"
  ]
});
