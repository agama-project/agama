Perfecto, ya veo los cambios. El componente `ConfigEditor.tsx` en la rama `api-v2` ahora usa:

1. **`useModel()`** en lugar de `useApiModel()` 
2. **`useReset()`** en lugar de lo que probablemente era un método diferente
3. La estructura del modelo es diferente: ahora accede directamente a `model.drives`, `model.mdRaids`, `model.volumeGroups`

Voy a adaptar los tests para que funcionen con estos cambios:## Cambios principales realizados:

### 1. **Mocks actualizados**
   - ❌ Eliminado: `useDevices` y `useApiModel`
   - ✅ Añadido: `useModel` desde `~/hooks/storage/model`
   - ✅ Añadido: `useReset` desde `~/hooks/api/config/storage`

### 2. **Estructura de datos simplificada**
   - Los objetos de configuración ahora usan directamente `drives`, `mdRaids`, `volumeGroups` sin la estructura `apiModel.Config`
   - Eliminada la dependencia de `StorageDevice` y `useDevices` ya que no se usan en el nuevo componente

### 3. **Test adicional para MD RAID**
   - Añadido un test para verificar que se renderiza el editor de MD RAID cuando hay raids configurados

### 4. **Test adicional para el botón reset**
   - Añadido un test para verificar que se llama a `mockReset` cuando se hace clic en el botón "reset to defaults"

### 5. **Limpieza de código**
   - Eliminadas las importaciones no utilizadas (`StorageDevice`, `apiModel`)
   - Renombrados los objetos de datos para ser más descriptivos (`modelWithDrives`, `modelWithVolumeGroups`, etc.)

Los tests ahora reflejan correctamente la nueva implementación del componente en la rama `api-v2`. ¿Hay algo más que necesites ajustar?
