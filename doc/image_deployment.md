# Image-Based Deployment

## Motivation

To provide a faster alternative to traditional package-by-package RPM installations, users can prepare a pre-built "gold" image that is deployed directly onto the target disk.
This approach enables users to pre-test package selections, pre-configure system customizations, and eliminate lengthy post-installation scripts.

At the same time, using Agama for image deployment retains all the key benefits of Agama's installer infrastructure:
- Advanced partitioning and volume management (LVM, Btrfs subvolumes, LUKS encryption, software RAID).
- Hardware detection and automated hardware enablement, this will lead to smaller golden images as with common image deployment all hardware support for boot have to be in image.
- Network configuration.
- Bootloader configuration (GRUB2, UEFI).

## Specification

Image-based deployment is configured in the `software` section of the Agama profile (`profile.json`) using the `image` subsection.

### Profile Schema

```json
{
  "product": {
    "id": "Tumbleweed"
  },
  "software": {
    "image": {
      "path": "/images/gold.tar.xz",
      "type": "tarball",
      "recommendedHardwarePackages": true
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Description |
|---|---|---|---|
| `path` | string | Yes | Path to the image file, disk image, or container reference. |
| `type` | string | Yes | Format of the image. Supported values: `"tarball"`, `"raw"`, `"oci"`. |
| `recommendedHardwarePackages` | boolean | No | Whether to run hardware enablement (`zypper inr --no-recommends`) in the target chroot after image deployment. Defaults to `false`. |

### Supported Image Types

1. **`tarball`**:
   An archive file (e.g. `.tar`, `.tar.xz`, `.tar.gz`, `.tar.zst`) containing the complete root filesystem (`rootfs`).
   Extracted directly to the target installation directory (`/mnt`) preserving all extended attributes, POSIX ACLs, SELinux security contexts, and numeric user/group IDs:
   ```bash
   tar --xattrs --xattrs-include='*' --acls --numeric-owner -xf <path> -C /mnt
   ```

2. **`raw`**:
   A raw filesystem or disk image (`.raw`, `.img`).
   Mounted read-only via a loopback device (`mount -o loop,ro` or partitioned disk via `losetup -fP --show`), and copied to `/mnt` with all metadata, permissions, and file attributes preserved:
   ```bash
   cp -a <mount_dir>/. /mnt/
   ```

3. **`oci`**:
   An OCI container image deployed directly using `podman export` piped into `tar`:
   ```bash
   podman create --name agama-oci-deploy <path>
   podman export agama-oci-deploy | tar --xattrs --xattrs-include='*' --acls --numeric-owner -xf - -C /mnt
   podman rm -f agama-oci-deploy
   ```
   This approach has several key benefits:
   - Streams the container rootfs directly into `/mnt` via kernel pipe buffers, completely avoiding intermediate unpacking into RAM (essential for `ramfs` live installer environments).
   - Operates independently of the live environment's storage driver and avoids nested OverlayFS mount restrictions.
   - Preserves all file extended attributes, POSIX ACLs, SELinux labels, and numeric user/group ownership.

## Architecture and Workflow

### 1. Lazy Zypp Server Initialization

In traditional RPM-based installations, Agama spawns a dedicated background `ZyppServer` thread that initializes libzypp on `/run/agama/zypp` and resolves packages.
When an image deployment is specified in the profile:
- `ZyppServer` does not run at all.
- No repository indexes or metadata are downloaded.
- No RPM solver is executed.
- `ImageModel` is used as the `ModelAdapter` implementation in `agama-software`.

### 2. Deployment Sequence

1. **Storage Setup**: Agama partitions and formats the disks according to the storage configuration and mounts the root filesystem on `/mnt`.
2. **Image Deployment**: The image contents are extracted or copied into `/mnt` using the method corresponding to the configured `type`.
3. **Hardware Enablement**: If `recommendedHardwarePackages` is enabled, Agama executes:
   ```bash
   chroot /mnt zypper --non-interactive inr --no-recommends
   ```
4. **Post-Configuration**: Users, hostname, network settings, and bootloader are configured on the deployed system.

## Profile Examples

### Example: Tarball Image

```json
{
  "product": {
    "id": "Tumbleweed"
  },
  "software": {
    "image": {
      "path": "/images/tumbleweed-gold.tar.xz",
      "type": "tarball",
      "recommendedHardwarePackages": true
    }
  }
}
```

### Example: Raw Image

```json
{
  "product": {
    "id": "Tumbleweed"
  },
  "software": {
    "image": {
      "path": "/images/system.raw",
      "type": "raw",
      "recommendedHardwarePackages": false
    }
  }
}
```

### Example: OCI Image

```json
{
  "product": {
    "id": "Tumbleweed"
  },
  "software": {
    "image": {
      "path": "/images/tumbleweed-oci",
      "type": "oci",
      "recommendedHardwarePackages": true
    }
  }
}
```
