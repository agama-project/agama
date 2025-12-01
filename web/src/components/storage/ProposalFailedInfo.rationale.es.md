¡Perfecto! Ahora puedo ver el problema. El test está usando la API antigua con `useApiModel`, `useConfigErrors` y `useIssues`, pero el componente actualizado usa `useStorageModel` de la nueva API v2.

Voy a adaptar el test para que funcione con los cambios:¡Listo! He adaptado el test a la nueva API v2. Los **cambios principales** son:

## 🔄 Cambios realizados:

1. **Reemplazado el mock**: Ahora usa `useStorageModel` de `~/hooks/api/storage` en lugar de `useApiModel`

2. **Estructura del modelo simplificada**: El nuevo modelo es más directo (sin la complejidad de `apiModel.Config`)

3. **Removidos mocks innecesarios**: Eliminé `useConfigErrors` y `useIssues` ya que el nuevo componente no los usa

4. **Tests reorganizados**: Los tests ahora reflejan la lógica actual:
   - Detecta particiones **sin nombre** como nuevas
   - Muestra todos los volúmenes lógicos (porque actualmente no son reutilizables)
   - Distingue entre boot configurado o no

5. **Eliminado código obsoleto**: Removí `fakeLogicalVolume` y las referencias a `Issue`, `IssueSource`, etc.

Los tests ahora cubren los tres escenarios principales del componente actualizado:
- ✅ Sin particiones/volúmenes nuevos → mensaje genérico
- ✅ Con boot configurado → menciona "boot partition"
- ✅ Sin boot configurado → sin mención a boot

¿Quieres que ajuste algo más o que explique alguna parte específica? 🚀
