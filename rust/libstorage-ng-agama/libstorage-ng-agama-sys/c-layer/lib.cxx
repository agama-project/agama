#include <cstdlib>
#include <cstring>
#include <exception>

#include <storage/Environment.h>
#include <storage/Storage.h>

#include "include/lib.h"

struct StorageHandle {
  storage::Storage storage;

  explicit StorageHandle(const storage::Environment &environment)
      : storage(environment) {}
};

static void set_ok(Status *status) {
  if (status) {
    status->ok = true;
    status->message = nullptr;
  }
}

static void set_error(Status *status, const char *message) {
  if (status) {
    status->ok = false;
    status->message = strdup(message);
  }
}

// Reports the current exception in the status. To be called from a catch block.
static void set_current_exception(Status *status) {
  try {
    throw;
  } catch (const std::exception &e) {
    set_error(status, e.what());
  } catch (...) {
    set_error(status, "Unknown libstorage-ng error");
  }
}

extern "C" {

void storage_status_free(Status *status) {
  if (status && status->message) {
    free(status->message);
    status->message = nullptr;
  }
}

StorageHandle *storage_new(bool read_only, ProbeMode mode, const char *input,
                           Status *status) {
  try {
    storage::ProbeMode probe_mode;
    switch (mode) {
    case PROBE_STANDARD:
      probe_mode = storage::ProbeMode::STANDARD;
      break;
    case PROBE_READ_MOCKUP:
      probe_mode = storage::ProbeMode::READ_MOCKUP;
      break;
    default:
      set_error(status, "Unknown probe mode");
      return nullptr;
    }

    storage::Environment environment(read_only, probe_mode,
                                     storage::TargetMode::DIRECT);
    if (mode == PROBE_READ_MOCKUP) {
      if (!input) {
        set_error(status, "A mockup file is required");
        return nullptr;
      }
      environment.set_mockup_filename(input);
    }

    StorageHandle *handle = new StorageHandle(environment);
    set_ok(status);
    return handle;
  } catch (...) {
    set_current_exception(status);
    return nullptr;
  }
}

void storage_free(StorageHandle *handle) { delete handle; }

} // extern "C"
