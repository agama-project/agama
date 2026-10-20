#include <cstdlib>
#include <cstring>
#include <exception>
#include <new>
#include <vector>

#include <storage/Devicegraph.h>
#include <storage/Devices/Disk.h>
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

void storage_probe(StorageHandle *handle, Status *status) {
  try {
    handle->storage.probe();
    set_ok(status);
  } catch (...) {
    set_current_exception(status);
  }
}

DiskList storage_probed_disks(const StorageHandle *handle, Status *status) {
  DiskList list = {nullptr, 0};

  try {
    const storage::Devicegraph *probed = handle->storage.get_probed();
    std::vector<const storage::Disk *> disks = storage::Disk::get_all(probed);

    // calloc zero-initializes the strings, so a partial list can be released
    // safely.
    list.disks =
        static_cast<DiskInfo *>(calloc(disks.size(), sizeof(DiskInfo)));
    if (!list.disks && !disks.empty())
      throw std::bad_alloc();

    for (const storage::Disk *disk : disks) {
      DiskInfo &info = list.disks[list.len++];
      info.name = strdup(disk->get_name().c_str());
      info.sysfs_path = strdup(disk->get_sysfs_path().c_str());
      info.size = disk->get_size();
    }

    set_ok(status);
  } catch (...) {
    storage_disk_list_free(&list);
    set_current_exception(status);
  }

  return list;
}

void storage_disk_list_free(DiskList *list) {
  if (!list)
    return;

  for (size_t i = 0; i < list->len; i++) {
    free(list->disks[i].name);
    free(list->disks[i].sysfs_path);
  }
  free(list->disks);
  list->disks = nullptr;
  list->len = 0;
}

} // extern "C"
