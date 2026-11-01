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
| `path` | string | Yes | Path to the local image file, remote URL (`http://`, `https://`, `ftp://`), or container image reference (e.g. `registry.mycompany.com/myorg/gold:latest`). |
| `type` | string | Yes | Format of the image. Supported values: `"tarball"`, `"raw"`, `"oci"`. |
| `insecure` | boolean | No | Whether to ignore SSL/TLS certificate verification when downloading via `curl` or pulling container images with `podman`. Defaults to `false`. |
| `recommendedHardwarePackages` | boolean | No | Whether to run hardware enablement (`zypper inr --no-recommends`) in the target chroot after image deployment. Defaults to `false`. |
| `installRequiredPackages` | boolean | No | Whether to install packages and patterns required by Agama (kernel, storage packages like `lvm2`/`btrfsprogs`, bootloader like `systemd-boot`, security patterns like `selinux`) via `zypper in --no-recommends` after deployment. Defaults to `false`. |

### Remote URLs and Parallel Streaming

When `path` is an HTTP, HTTPS, or FTP URL:
- **Tarballs**: Streamed directly in parallel through a pipeline: `curl | [parallel decompressor -T0] | tar -xf - -C /mnt`. No intermediate archive is written to disk or RAM.
- **Raw Images**: Downloaded directly into the target filesystem (`/mnt/.agama_image_download.tmp`) using `curl -sSL -f`, decompressed, loop mounted, and copied. The temporary download file is automatically deleted.

### Supported Image Types

1. **`tarball`**:
   An archive file (e.g. `.tar`, `.tar.xz`, `.tar.gz`, `.tar.zst`, `.tar.bz2`) containing the complete root filesystem (`rootfs`).
   - Compressed archives are decompressed with maximum parallelism (`xz -dc -T0`, `zstd -dc -T0`) and piped directly into `tar` without temporary files.
   - Extracted directly to the target installation directory (`/mnt`) preserving all extended attributes, POSIX ACLs, SELinux security contexts, and numeric user/group IDs:
   ```bash
   tar --xattrs --xattrs-include='*' --acls --numeric-owner -xf - -C /mnt
   ```

2. **`raw`**:
   A raw filesystem or disk image (`.raw`, `.img`), which can be uncompressed or compressed (`.raw.xz`, `.raw.gz`, `.raw.bz2`, `.raw.zst`).
   - If compressed, the image is decompressed directly onto the destination filesystem (`/mnt/.agama_decompressed_image.raw`) using multi-threaded decompressors (`xz -T0`, `zstd -T0`, etc.) to avoid RAM consumption.
   - Mounted read-only via a loopback device (`mount -o loop,ro` or partitioned disk via `losetup -fP --show`), and copied to `/mnt` preserving all metadata, permissions, and file attributes:
   ```bash
   cp -a <mount_dir>/. /mnt/
   ```
   - Any temporary decompressed raw file is cleaned up after copying.

3. **`oci`**:
   An OCI container image deployed directly using `podman export` piped into `tar`:
   ```bash
   podman create [--tls-verify=false] --name agama-oci-deploy <image-ref>
   podman export agama-oci-deploy | tar --xattrs --xattrs-include='*' --acls --numeric-owner -xf - -C /mnt
   podman rm -f agama-oci-deploy
   ```
   Custom registries are specified directly in `path`:
   ```json
   "image": {
     "type": "oci",
     "path": "registry.mycompany.com/myorg/gold:latest",
     "insecure": true
   }
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
3. **Required Packages**: If `installRequiredPackages` is enabled, Agama installs packages and patterns required by Agama (`kernel`, storage packages, `bootloader`, `selinux`, etc.) via:
   ```bash
   chroot /mnt zypper --non-interactive in --no-recommends <pkgs/patterns>
   ```
4. **Hardware Enablement**: If `recommendedHardwarePackages` is enabled, Agama executes:
   ```bash
   chroot /mnt zypper --non-interactive inr --no-recommends
   ```
   Because required packages (such as `kernel-default` and storage tools) were installed in step 3, Zypper's hardware supplements and recommendations correctly match the installed software and hardware.
5. **Post-Configuration**: Users, hostname, network settings, and bootloader are configured on the deployed system.

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

## Helper Script & Test Profile

- **Helper script**: [`devel/build_gold_image.sh`](../devel/build_gold_image.sh) generates a bootable openSUSE Tumbleweed rootfs tarball containing the kernel, systemd-boot, LVM support, and base networking:
  ```bash
  ./devel/build_gold_image.sh /var/tmp/tumbleweed-gold.tar
  ```
- **Example profile**: [`rust/share/examples/profile_tw_image.json`](../rust/share/examples/profile_tw_image.json) provides a complete profile using LVM, root password `linux`, and the golden image.
