#ifndef C_REPOSITORY_H_
#define C_REPOSITORY_H_

#include "callbacks.h"
#include "lib.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

struct Repository {
  bool enabled;   ///<
  char *url;      ///< owned
  char *alias;    ///< owned
  char *userName; ///< owned
};

struct RepositoryList {
  const unsigned size;
  /// dynamic array with given size
  struct Repository *repos; ///< owned, *size* items
};

/// repository array in list.
/// when no longer needed, use \ref free_repository_list to release memory
/// @param zypp see \ref init_target
/// @param[out] status (will overwrite existing contents)
struct RepositoryList list_repositories(struct Zypp *zypp,
                                        struct Status *status) noexcept;

void free_repository_list(struct RepositoryList *repo_list) noexcept;

/// Adds repository to repo manager
/// @param zypp see \ref init_target
/// @param alias have to be unique
/// @param url can contain repo variables
/// @param[out] status (will overwrite existing contents)
/// @param callback pointer to function with callback or NULL
/// @param user_data
void add_repository(struct Zypp *zypp, const char *alias, const char *url,
                    struct Status *status, ZyppProgressCallback callback,
                    void *user_data) noexcept;

/// Disable repository in repo manager
/// @param zypp see \ref init_target
/// @param alias identifier of repository
void disable_repository(struct Zypp *zypp, const char *alias,
                        struct Status *status) noexcept;

/// Changes url of given repository
/// @param zypp see \ref init_target
/// @param alias identifier of repository
/// @param alias have to be unique
void set_repository_url(struct Zypp *zypp, const char *alias, const char *url,
                        struct Status *status) noexcept;

/// Removes repository from repo manager
/// @param zypp see \ref init_target
/// @param alias have to be unique
/// @param[out] status (will overwrite existing contents)
/// @param callback pointer to function with callback or NULL
/// @param user_data
void remove_repository(struct Zypp *zypp, const char *alias,
                       struct Status *status, ZyppProgressCallback callback,
                       void *user_data) noexcept;

///
/// @param zypp see \ref init_target
/// @param alias alias of repository to refresh
/// @param[out] status (will overwrite existing contents)
/// @param progress pointer to struct with callbacks or NULL if no progress is
/// needed
/// @param security pointer to struct with security callbacks
void refresh_repository(struct Zypp *zypp, const char *alias,
                        struct Status *status,
                        struct DownloadProgressCallbacks *progress,
                        struct SecurityCallbacks *security) noexcept;

void build_repository_cache(struct Zypp *zypp, const char *alias,
                            struct Status *status,
                            ZyppProgressCallback callback,
                            void *user_data) noexcept;
void load_repository_cache(struct Zypp *zypp, const char *alias,
                           struct Status *status) noexcept;

#ifdef __cplusplus
}
#endif
#endif