¡Perfecto! Ahora veo el test desactualizado. Voy a adaptarlo a la nueva API v2. Los cambios principales son:

- Reemplazar el mock de `useConfigModel` por `useStorageModel`
- Actualizar la estructura de datos del modelo
- Adaptar los tipos y la estructura de dispositivos¡Listo! He adaptado `SpaceActionsTable.test.tsx` a la nueva API v2. 

## 🔄 Cambios principales realizados:

### 1. **Nuevo hook de API v2**
- ✅ `useStorageModel()` reemplaza `useConfigModel()`
- ✅ Mock actualizado desde `~/hooks/api/storage`

### 2. **Tipos de dispositivos actualizados**
- ✅ Uso de `Device` y `UnusedSlot` de `~/api/proposal/storage`
- ✅ Estructura `block.size` y `block.shrinking` en lugar de `size` y `shrinking` directamente
- ✅ `shrinking.minSize` en lugar de `shrinking.supported`
- ✅ `shrinking.reasons` en lugar de `shrinking.unsupported`

### 3. **Estructura del modelo simplificada**
```typescript
// Antes (API v1)
{
  drives: [
    { name: "/dev/sda", partitions: [
      { name: "/dev/sda2", mountPath: "swap", filesystem: { reuse: false, default: true } }
    ]}
  ]
}

// Ahora (API v2)
{
  drives: [
    { name: "/dev/sda", partitions: [
      { name: "/dev/sda2", mountPath: "swap", filesystem: { type: "swap" } }
    ]}
  ],
  volumeGroups: []
}
```

### 4. **Funcionalidad preservada**
Todos los tests mantienen la misma lógica y escenarios:
- ✅ Muestra dispositivos con acciones configurables
- ✅ Selecciona la acción correcta para cada dispositivo
- ✅ Deshabilita shrink cuando no está soportado
- ✅ Deshabilita acciones cuando la partición está en uso
- ✅ Permite cambiar acciones
- ✅ Muestra información sobre dispositivos

¿Necesitas adaptar más archivos de test o algún ajuste adicional? 🚀
