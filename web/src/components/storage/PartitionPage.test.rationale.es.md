Perfecto, ahora voy a adaptar los tests de PartitionPage para la rama api-v2. Veo cambios similares a FormattableDevicePage más algunos específicos de las particiones.Perfecto, he adaptado los tests de PartitionPage para la rama api-v2. Los cambios principales son:

## Cambios realizados:

1. **Tipos actualizados**:
   - `StorageDevice` → `system.Device` 
   - `Volume` → `apiModel.VolumeTemplate`
   - Importaciones de tipos desde `~/api/storage` y `~/api/system`

2. **Estructura de dispositivos**:
   - Simplificada la estructura de `sda1` y `sda` con solo las propiedades necesarias de la API
   - Removidas propiedades que ya no existen (`isDrive`, `sid`, `shrinking`, `systems`, etc.)
   - Agregados `filesystem: null` y `partitionTable: null` donde corresponde
   - Agregado `partitions: [sda1]` en `sda`

3. **Mocks de hooks**:
   - **`useDevice`**: Mock del nuevo hook de `~/hooks/api/system/storage`
   - **`useVolumeTemplate`**: Reemplaza a `useVolume`
   - **`useDrive` y `useMdRaid`**: Agregados para los nuevos hooks del modelo
   - **`useStorageModel`**: Agregado nuevo mock de `~/hooks/api/storage`
   - **`useMissingMountPaths`**: Ahora viene de `~/hooks/storage/model`
   - Removido el mock de `useDevices` que ya no se usa

4. **Parámetros de ruta**:
   - `list` → `collection`
   - `listIndex` → `index`

5. **Propiedades del volumen**:
   - Removidas `mountOptions`, `target`, `transactional` de `VolumeTemplate`

6. **Polyfill JSDOM**:
   - Agregado el mismo polyfill para `requestSubmit` que en FormattableDevicePage

7. **Inicialización en beforeEach**:
   - Agregados valores de retorno para todos los mocks necesarios
   - `mockStorageModel` inicializado con el modelo de storage

Los tests ahora están completamente adaptados para la rama api-v2 y deberían ejecutarse sin problemas. ¿Hay algo más que necesites ajustar?
