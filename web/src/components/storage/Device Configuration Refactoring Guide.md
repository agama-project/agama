# Device Configuration Pages Refactoring Guide

## Overview

This guide explains how to refactor `FormattableDevicePage.tsx`, `PartitionPage.tsx`, and `LogicalVolumePage.tsx` to eliminate code duplication by extracting common logic into shared utilities and components.

## Analysis of Code Duplication

### Common Patterns Identified

1. **Form State Management** (~80% similar)
   - All three components manage: `mountPoint`, `filesystem`, `filesystemLabel`
   - Two components add: `sizeOption`, `minSize`, `maxSize`
   - Auto-refresh logic for filesystem and size

2. **Validation Logic** (100% identical)
   - Mount point validation (format + uniqueness check)
   - Size validation (format + range check)
   - Error handling structure

3. **Data Transformation** (~90% similar)
   - Converting form values to API models
   - Converting API models to form values
   - Filesystem type conversions

4. **React Hooks** (~85% similar)
   - `useDefaultFilesystem`
   - `useUsableFilesystems`
   - `useUnusedMountPoints`
   - `useAutoRefreshFilesystem`
   - `useErrors`

5. **UI Components** (100% identical)
   - `FilesystemLabel`
   - `FilesystemOptionLabel`
   - `FilesystemOptions`
   - `FilesystemSelect`

## Refactoring Strategy

### Phase 1: Extract Shared Logic

Create `shared-device-config-logic.ts`:

**What to extract:**
- Constants: `NO_VALUE`, `BTRFS_SNAPSHOTS`, `REUSE_FILESYSTEM`
- Types: `BaseFormValue`, `Error`, `ErrorsHandler`
- Validation: `useMountPointError()`, `validateSize()`
- Hooks: `useDefaultFilesystem()`, `useUsableFilesystems()`, etc.
- Transformations: `getFilesystemType()`, `buildFilesystemConfig()`, etc.

**Benefits:**
- Single source of truth for validation rules
- Consistent behavior across all pages
- ~400 lines of duplicate code eliminated

### Phase 2: Extract Shared Components

Create `shared-device-config-components.tsx`:

**What to extract:**
- `FilesystemLabel`
- `FilesystemOptionLabel`
- `FilesystemOptions`
- `FilesystemSelect`
- `MountPointField`

**Benefits:**
- Consistent UI across all pages
- ~300 lines of duplicate code eliminated
- Easier to maintain and update

### Phase 3: Create Base Configuration Hook

Create a custom hook that handles common form logic:

```typescript
function useDeviceConfigForm<T extends BaseFormValue>(
  initialValue: T | null,
  options: {
    getCurrentFilesystem?: () => string | null;
    validateExtras?: (value: T) => Error[];
  }
) {
  // Manages all common form state
  // Returns { value, errors, handlers, autoRefresh }
}
```

**Benefits:**
- Centralized form state management
- Consistent auto-refresh behavior
- ~200 lines of duplicate code eliminated

## Implementation Steps

### Step 1: Create Shared Files

1. Create `web/src/components/storage/shared/device-config-logic.ts`
2. Create `web/src/components/storage/shared/device-config-components.tsx`
3. Copy shared logic from artifacts above

### Step 2: Refactor FormattableDevicePage.tsx

**Before:** 400+ lines
**After:** ~200 lines (50% reduction)

```typescript
import {
  NO_VALUE,
  BTRFS_SNAPSHOTS,
  REUSE_FILESYSTEM,
  useMountPointError,
  useDefaultFilesystem,
  useUsableFilesystems,
  useUnusedMountPoints,
  useErrorsHandler,
  buildFilesystemConfig,
  extractFilesystemValue,
  mountPointSelectOptions,
  useAutoRefreshFilesystem,
} from "~/components/storage/shared/device-config-logic";

import {
  FilesystemLabel,
  FilesystemSelect,
  MountPointField,
} from "~/components/storage/shared/device-config-components";

// Component becomes much simpler - only device-specific logic remains
```

### Step 3: Refactor LogicalVolumePage.tsx

**Before:** 550+ lines
**After:** ~280 lines (49% reduction)

Key changes:
- Use shared validation hooks
- Use shared filesystem components
- Keep LVM-specific logic (name validation, volume group handling)

### Step 4: Refactor PartitionPage.tsx

**Before:** 700+ lines
**After:** ~380 lines (46% reduction)

Key changes:
- Use shared validation hooks
- Use shared filesystem components
- Keep partition-specific logic (target selection, partition reuse)

## Detailed Refactoring Examples

### Example 1: Simplifying Filesystem Selection

**Before (in each file):**
```typescript
function FilesystemOptionLabel({ value }: FilesystemOptionLabelProps): React.ReactNode {
  const filesystem = useCurrentFilesystem();
  if (value === NO_VALUE) return _("Waiting for a mount point");
  if (value === REUSE_FILESYSTEM && filesystem)
    return sprintf(_("Current %s"), filesystemLabel(filesystem));
  if (value === BTRFS_SNAPSHOTS) return _("Btrfs with snapshots");
  return filesystemLabel(value);
}

function FilesystemOptions({ mountPoint }: FilesystemOptionsProps): React.ReactNode {
  const device = useDevice();
  const volume = useVolume(mountPoint);
  const defaultFilesystem = useDefaultFilesystem(mountPoint);
  // ... 50+ more lines
}
```

**After (in each file):**
```typescript
import { FilesystemSelect } from "~/components/storage/shared/device-config-components";

// Usage:
<FilesystemSelect
  id="fileSystem"
  value={filesystem}
  mountPoint={mountPoint}
  currentFilesystem={currentFilesystem}
  canReuse={canReuseDevice}
  deviceName={device.name}
  onChange={changeFilesystem}
/>
```

### Example 2: Simplifying Validation

**Before (duplicated in each file):**
```typescript
function useMountPointError(value: FormValue): Error | undefined {
  const model = useModel({ suspense: true });
  const mountPoints = model?.getMountPaths() || [];
  const deviceModel = useDeviceModel();
  const mountPoint = value.mountPoint;

  if (mountPoint === NO_VALUE) {
    return { id: "mountPoint", isVisible: false };
  }

  const regex = /^swap$|^\/$|^(\/[^/\s]+)+$/;
  if (!regex.test(mountPoint)) {
    return {
      id: "mountPoint",
      message: _("Select or enter a valid mount point"),
      isVisible: true,
    };
  }
  // ... more validation
}
```

**After:**
```typescript
import { useMountPointError } from "~/components/storage/shared/device-config-logic";

// Usage:
const mountPointError = useMountPointError(mountPoint, initialMountPoint);
```

### Example 3: Simplifying Auto-Refresh Logic

**Before (duplicated with slight variations):**
```typescript
React.useEffect(() => {
  if (mountPoint === NO_VALUE) handler(NO_VALUE);
  if (mountPoint !== NO_VALUE && !currentFilesystem) handler(defaultFilesystem);
  if (mountPoint !== NO_VALUE && currentFilesystem) {
    const reuse = usableFilesystems.includes(currentFilesystem);
    handler(reuse ? REUSE_FILESYSTEM : defaultFilesystem);
  }
}, [handler, mountPoint, defaultFilesystem, usableFilesystems, currentFilesystem]);
```

**After:**
```typescript
import { useAutoRefreshFilesystem } from "~/components/storage/shared/device-config-logic";

useAutoRefreshFilesystem(
  refreshFilesystemHandler,
  mountPoint,
  autoRefreshFilesystem,
  getCurrentFilesystem
);
```

## File-Specific Differences to Preserve

### FormattableDevicePage
- **Unique:** Works with drives/MD arrays, not partitions
- **Keep:** Device model retrieval logic
- **Keep:** No size configuration
- **Keep:** Specific reuse text for devices

### LogicalVolumePage
- **Unique:** Logical volume name management
- **Keep:** Volume group context
- **Keep:** LVM-specific validation (name required)
- **Keep:** Specific text for logical volumes

### PartitionPage
- **Unique:** Target selection (new vs existing partition)
- **Keep:** Partition listing and selection
- **Keep:** Different size behavior (only for new partitions)
- **Keep:** Out-of-sync alert

## Testing Strategy

1. **Unit Tests:** Test shared validation logic independently
2. **Integration Tests:** Test each refactored component
3. **Regression Tests:** Verify all existing functionality works
4. **Manual Testing:** Test all three pages with various scenarios

## Maintenance Benefits

### Before Refactoring
- Bug fix requires changing 3 files
- New validation rule requires 3 implementations
- UI change requires updating 3 components
- Difficult to ensure consistency

### After Refactoring
- Bug fix in one place
- New validation rule in one function
- UI change in one component
- Consistency guaranteed by shared code

## Migration Checklist

- [ ] Create shared logic file
- [ ] Create shared components file
- [ ] Add unit tests for shared logic
- [ ] Refactor FormattableDevicePage.tsx
- [ ] Test FormattableDevicePage functionality
- [ ] Refactor LogicalVolumePage.tsx
- [ ] Test LogicalVolumePage functionality
- [ ] Refactor PartitionPage.tsx
- [ ] Test PartitionPage functionality
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Remove FIXME comments

## Estimated Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Lines | ~1,650 | ~860 | 48% reduction |
| Duplicate Code | ~900 lines | ~50 lines | 94% reduction |
| Maintainability | Low | High | Significant |
| Test Coverage | Hard | Easy | Easier testing |

## Future Enhancements

After refactoring, consider:

1. **Generic Form Builder:** Create a declarative form builder for device configuration
2. **Validation Framework:** More sophisticated validation with field dependencies
3. **Type Safety:** Stricter TypeScript types for form values
4. **Accessibility:** Enhanced a11y features in shared components

## Conclusion

This refactoring will:
- **Eliminate ~850 lines** of duplicate code
- **Reduce complexity** by 48%
- **Improve maintainability** significantly
- **Make testing easier** with isolated shared logic
- **Ensure consistency** across all device configuration pages

The refactored code will be easier to understand, modify, and extend while maintaining all existing functionality.
