Perfecto, veo los cambios en `LvmPage.tsx` de la rama `api-v2`. Los principales cambios son:

1. **`useAvailableDevices()`** ahora viene de `~/hooks/api/system/storage` en lugar de `~/hooks/storage/system`
2. **`useModel()`** sigue siendo el mismo hook
3. **`useVolumeGroup()`**, **`useAddVolumeGroup()`**, y **`useEditVolumeGroup()`** ahora vienen de `~/hooks/storage/volume-group`

Voy a adaptar los tests:## Cambios principales realizados en LvmPage.test.tsx:

### 1. **Actualización de imports y tipos**
   - ✅ Cambiado `StorageDevice` por `storage.Device` del tipo `~/api/system`
   - ✅ Añadido `import type { storage } from "~/api/system"`
   - Los dispositivos `sda`, `sdb`, y `sda1` ahora usan el tipo `storage.Device`

### 2. **Actualización de mocks**
   - ❌ Eliminado: mock de `~/queries/storage` con `useDevices`
   - ❌ Eliminado: mock de `~/hooks/storage/system` con `useAvailableDevices`
   - ✅ Añadido: mock de `~/hooks/api/system/storage` con `useAvailableDevices`
   - ✅ Añadido: `mockUseVolumeGroup` para el hook `useVolumeGroup`
   - ✅ Actualizado: mock de `~/hooks/storage/volume-group` ahora incluye `useVolumeGroup`

### 3. **Gestión del estado de `useVolumeGroup`**
   - ✅ Añadido `beforeEach` en "when creating a new volume group" para que `mockUseVolumeGroup` retorne `undefined`
   - ✅ Añadido `beforeEach` en "when editing" para que `mockUseVolumeGroup` retorne `mockRootVolumeGroup`
   - ✅ Añadida limpieza de mocks en el `beforeEach` global

### 4. **Correcciones estructurales**
   - La variable `mockUseAvailableDevices` reemplaza a `mockUseAllDevices`
   - Se mantiene la misma estructura de tests pero adaptada a los nuevos hooks

Los tests ahora reflejan correctamente la estructura de la rama `api-v2`, donde:
- Los dispositivos disponibles vienen de `useAvailableDevices()` desde `~/hooks/api/system/storage`
- El hook `useVolumeGroup()` se usa para obtener el volume group cuando se está editando
- Los tipos de dispositivos usan la estructura de la API del sistema

¿Hay algo más que necesites adaptar?
