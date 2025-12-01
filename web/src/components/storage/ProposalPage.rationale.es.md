¡Perfecto! Ahora veo todo el código. Voy a adaptar el test a la nueva API v2. Los cambios principales son:

- Reemplazar `useConfigModel` por `useStorageModel`
- Reemplazar `useSystemErrors`/`useConfigErrors` por `useIssues`
- Actualizar los mocks de hooks obsoletos
- Adaptar la lógica de clasificación de issues¡Listo! He adaptado completamente `ProposalPage.test.tsx` a la nueva API v2. 

## 🔄 Cambios principales realizados:

### 1. **Nuevos hooks de API v2**
- ✅ `useStorageModel()` reemplaza `useConfigModel()`
- ✅ `useProposal()` para obtener la propuesta
- ✅ `useIssues("storage")` reemplaza `useSystemErrors()` y `useConfigErrors()`
- ✅ `useReset()` reemplaza el mutation de reset
- ✅ `useAvailableDevices()` desde el nuevo path

### 2. **Nueva lógica de clasificación de issues**
El componente ahora clasifica los issues en:
- **Fixables**: `configNoRoot`, `configRequiredPaths`, `configOverusedPvTarget`, `configOverusedMdMember`, `proposal`
- **Config issues**: Todos excepto los de clase `proposal`
- **Unfixable issues**: Los que no están en la lista de fixables

### 3. **Escenarios de test actualizados**
Los tests ahora cubren correctamente:
- ✅ Sin dispositivos disponibles
- ✅ Sin modelo pero con issues unfixables → muestra reset
- ✅ Sin modelo pero con config issues → muestra reset
- ✅ Sin modelo, sin issues, sin propuesta → muestra reset (UnknownConfigEmptyState)
- ✅ Sin modelo pero con propuesta válida → muestra UnsupportedModelInfo + result
- ✅ Con modelo + config + unfixable issues → muestra InvalidConfigEmptyState
- ✅ Con modelo + proposal issues → muestra ProposalFailedInfo + devices
- ✅ Con modelo + config fixable issues → muestra FixableConfigInfo + devices
- ✅ Con modelo + propuesta válida → muestra devices + result

### 4. **Mocks limpiados**
Eliminé los mocks obsoletos como `useDeprecated`, `useResetConfigMutation`, `useReprobeMutation`, etc.

¿Todo listo o necesitas algún ajuste adicional? 🚀
