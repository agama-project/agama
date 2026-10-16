#ifndef AGAMA_STORAGE_LIB_H
#define AGAMA_STORAGE_LIB_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/// Result of a call that can fail.
///
/// Functions taking a `struct Status *` always fill it. When `ok` is false,
/// `message` is owned by the caller and must be released with
/// `storage_status_free`.
struct Status {
  bool ok;
  char *message;
};

/// Releases the message of the status (if any).
void storage_status_free(struct Status *status);

/// Opaque handle wrapping a libstorage-ng `Storage` object.
struct StorageHandle;

enum ProbeMode {
  /// Probe the real system (requires root).
  PROBE_STANDARD = 0,
  /// Fake probing based on a mockup file (no root required).
  PROBE_READ_MOCKUP,
};

/// Creates a storage object. It does not activate nor probe the system.
///
/// `input` is the mockup file for PROBE_READ_MOCKUP and it is ignored
/// otherwise. Returns NULL on error (see `status`).
struct StorageHandle *storage_new(bool read_only, enum ProbeMode mode,
                                  const char *input, struct Status *status);

/// Releases the storage object (NULL is allowed).
void storage_free(struct StorageHandle *handle);

#ifdef __cplusplus
}
#endif

#endif
