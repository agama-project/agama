#ifndef C_LIB_H_
#define C_LIB_H_

#include "callbacks.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif
#ifndef __cplusplus
#define noexcept ;
#endif

/// status struct to pass and obtain from calls that can fail.
/// After usage free with \ref free_status function.
///
/// Most functions act as *constructors* for this, taking a pointer
/// to it as an output parameter, disregarding the struct current contents
/// and filling it in. Thus, if you reuse a `Status` without \ref free_status
/// in between, `error` will leak.
struct Status {
  // lets use enum for future better distinguish
  enum STATE {
    STATE_SUCCEED,
    STATE_FAILED,
  } state;
  /// detailed user error what happens. Only defined when not succeed
  char *error; ///< owned
};
void free_status(struct Status *s) noexcept;

/// Opaque Zypp context
struct Zypp;

/// Progress reporting callback used by methods that takes longer.
/// @param text  text for user describing what is happening now
/// @param stage current stage number starting with 0
/// @param total count of stages. It should not change during single call of
/// method.
/// @param user_data is never touched by method and is used only to pass local
/// data for callback
/// @todo Do we want to support response for callback that allows early exit of
/// execution?
typedef void (*ProgressCallback)(const char *text, unsigned stage,
                                 unsigned total, void *user_data);
/// Initialize Zypp target (where to store zypp data).
/// The returned zypp context is not thread safe and should be protected by a
/// mutex in the calling layer.
/// @param root
/// @param[out] status
/// @param progress
/// @param user_data
/// @return zypp context
struct Zypp *init_target(const char *root, struct Status *status,
                         ProgressCallback progress, void *user_data) noexcept;

/// Switch Zypp target (where to install packages to).
/// @param root
/// @param[out] status
void switch_target(struct Zypp *zypp, const char *root,
                   struct Status *status) noexcept;

/// Commit zypp settings and install
/// TODO: install callbacks
/// @param zypp
/// @param status
/// @param download_callbacks
/// @return true if there is no error
bool commit(struct Zypp *zypp, struct Status *status,
            struct DownloadResolvableCallbacks *download_callbacks) noexcept;

/// Represents a single mount point and its space usage.
/// The string pointers are not owned by this struct.
struct MountPoint {
  const char *directory;  ///< The path where the filesystem is mounted.
  const char *filesystem; ///< The filesystem type (e.g., "btrfs", "xfs").
  bool grow_only;
  long long
      used_size; ///< The used space in kilobytes. This is an output field.
};

/// Calculates the space usage for a given list of mount points.
/// This function populates the `used_size` field for each element in the
/// provided `mount_points` array.
///
/// @param zypp The Zypp context.
/// @param[out] status Output status object.
/// @param[in,out] mount_points An array of mount points to be evaluated.
/// @param mount_points_size The number of elements in the `mount_points` array.
void get_space_usage(struct Zypp *zypp, struct Status *status,
                     struct MountPoint *mount_points,
                     unsigned mount_points_size) noexcept;

enum RESOLVABLE_KIND {
  RESOLVABLE_PRODUCT,
  RESOLVABLE_PATCH,
  RESOLVABLE_PACKAGE,
  RESOLVABLE_SRCPACKAGE,
  RESOLVABLE_PATTERN,
};

enum RESOLVABLE_SELECTED {
  /// resolvable won't be installed
  NOT_SELECTED,
  /// dependency solver select resolvable
  /// match TransactByValue::SOLVER
  SOLVER_SELECTED,
  /// installation proposal selects resolvable
  /// match TransactByValue::APPL_{LOW,HIGH} we do not need both, so we use just
  /// one value
  APPLICATION_SELECTED,
  /// user select resolvable for installation
  /// match TransactByValue::USER
  USER_SELECTED,
};

/// Marks resolvable for installation
/// @param zypp see \ref init_target
/// @param name resolvable name
/// @param kind kind of resolvable
/// @param who who do selection. If NOT_SELECTED is used, it will be empty
/// operation.
/// @param[out] status (will overwrite existing contents)
void resolvable_select(struct Zypp *zypp, const char *name,
                       enum RESOLVABLE_KIND kind, enum RESOLVABLE_SELECTED who,
                       struct Status *status) noexcept;

/// Unselect resolvable for installation. It can still be installed as
/// dependency.
/// @param zypp see \ref init_target
/// @param name resolvable name
/// @param kind kind of resolvable
/// @param who who do unselection. Only unselect if it is higher or equal level
/// then who do the selection.
/// @param[out] status (will overwrite existing contents)
void resolvable_unselect(struct Zypp *zypp, const char *name,
                         enum RESOLVABLE_KIND kind,
                         enum RESOLVABLE_SELECTED who,
                         struct Status *status) noexcept;

/// Reset status of all resolvables, unselects selected packages, patterns...
/// Note: this also resets the user locks ("taboo" or "keep installed")
void resolvable_reset_all(struct Zypp *_zypp) noexcept;

struct PatternNames {
  /// names of patterns
  const char *const *const names;
  /// size of names array
  unsigned size;
};

/// Info from zypp::Pattern.
/// https://doc.opensuse.org/projects/libzypp/HEAD/classzypp_1_1Pattern.html
struct PatternInfo {
  char *name;        ///< owned
  char *category;    ///< owned
  char *icon;        ///< owned
  char *description; ///< owned
  char *summary;     ///< owned
  char *order;       ///< owned
  enum RESOLVABLE_SELECTED selected;
};

struct PatternInfos {
  struct PatternInfo *infos; ///< owned, *size* items
  unsigned size;
};

/// Get Pattern details.
/// Unknown patterns are simply omitted from the result. Match by
/// PatternInfo.name, not by index.
struct PatternInfos get_patterns_info(struct Zypp *_zypp,
                                      struct PatternNames names,
                                      struct Status *status) noexcept;
void free_pattern_infos(const struct PatternInfos *infos) noexcept;

void import_gpg_key(struct Zypp *zypp, const char *const pathname,
                    struct Status *status) noexcept;

/// check if url has local schema
/// @param url url to check
/// @param[out] status (will overwrite existing contents)
/// @return true if url is local, for invalid url status is set to error
bool is_local_url(const char *url, struct Status *status) noexcept;

/// check if package is available
/// @param zypp see \ref init_target
/// @param tag package name, provides or file path
/// @param[out] status (will overwrite existing contents)
/// @return true if package is available. In case of error it fills status and
/// return value is undefined
bool is_package_available(struct Zypp *zypp, const char *tag,
                          struct Status *status) noexcept;

/// check if package is selected for installation
/// @param zypp see \ref init_target
/// @param tag package name, provides or file path
/// @param[out] status (will overwrite existing contents)
/// @return true if package is selected. In case of error it fills status and
/// return value is undefined
bool is_package_selected(struct Zypp *zypp, const char *tag,
                         struct Status *status) noexcept;

/// Runs solver
/// @param zypp see \ref init_target
/// @param[out] status (will overwrite existing contents)
/// @return true if solver pass and false if it found some dependency issues
bool run_solver(struct Zypp *zypp, struct Status *status) noexcept;

/// the last call that will free all pointers to zypp holded by agama
void free_zypp(struct Zypp *zypp) noexcept;

#ifdef __cplusplus
}
#endif
#endif
