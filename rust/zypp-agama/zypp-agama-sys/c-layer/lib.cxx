#include "lib.h"
#include "callbacks.h"
#include "callbacks.hxx"
#include "helpers.hxx"
#include "repository.h"

#include <cstddef>
#include <cstdlib>
#include <exception>
#include <zypp-core/Pathname.h>
#include <zypp-core/Url.h>
#include <zypp/Pattern.h>
#include <zypp/PublicKey.h>
#include <zypp/RepoInfo.h>
#include <zypp/RepoManager.h>
#include <zypp/RepoManagerFlags.h>
#include <zypp/ResKind.h>
#include <zypp/ResObject.h>
#include <zypp/ResStatus.h>
#include <zypp/Resolvable.h>
#include <zypp/ZYpp.h>
#include <zypp/ZYppCommit.h>
#include <zypp/ZYppFactory.h>
#include <zypp/base/LogControl.h>
#include <zypp/base/Logger.h>

#include <zypp/ui/Selectable.h>

extern "C" {

struct Zypp {
  zypp::ZYpp::Ptr zypp_pointer;
  zypp::RepoManager *repo_manager;
};

static struct Zypp the_zypp {
  .zypp_pointer = NULL, .repo_manager = NULL,
};

void free_zypp(struct Zypp *zypp) noexcept {
  // ensure that target is unloaded otherwise nasty things can happen if new
  // zypp is created in different thread
  zypp->zypp_pointer->getTarget()->unload();
  zypp->zypp_pointer =
      NULL; // shared ptr assignment operator will free original pointer
  delete (zypp->repo_manager);
  zypp->repo_manager = NULL;
}

static zypp::ZYpp::Ptr zypp_ptr() {
  // set logging to ~/zypp-agama.log for now. For final we need to decide it
  zypp::Pathname home(getenv("HOME"));
  zypp::Pathname log_path = home.cat("zypp-agama.log");
  zypp::base::LogControl::instance().logfile(log_path);

  int max_count = 5;
  unsigned int seconds = 3;

  zypp::ZYpp::Ptr zypp = NULL;
  while (zypp == NULL && max_count > 0) {
    try {
      zypp = zypp::getZYpp();

      return zypp;
    } catch (const zypp::Exception &excpt) {
      max_count--;

      sleep(seconds);
    }
  }

  return NULL;
}

void switch_target(struct Zypp *zypp, const char *root,
                   struct Status *status) noexcept {
  const std::string root_str(root);
  try {
    zypp->zypp_pointer->initializeTarget(root_str,
                                         false /* rebuild rpmdb: no */);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return;
  }

  STATUS_OK(status);
}

bool commit(struct Zypp *zypp, struct Status *status) noexcept {
  try {
    zypp::ZYppCommitPolicy policy;
    zypp::ZYppCommitResult result = zypp->zypp_pointer->commit(policy);
    STATUS_OK(status);
    return result.noError();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return false;
  }
}

// TODO: split init target into set of repo manager, initialize target and load
// target and merge it in rust
struct Zypp *init_target(const char *root, struct Status *status,
                         ProgressCallback progress, void *user_data) noexcept {
  if (the_zypp.zypp_pointer != NULL) {
    STATUS_ERROR(status, "Cannot have two init_target concurrently, "
                         "libzypp not ready for this. Call free_zypp first.");
    return NULL;
  }

  const std::string root_str(root);

  struct Zypp *zypp = NULL;
  try {
    zypp::RepoManagerOptions repo_manager_options(root);
    // repository manager options cannot be replaced, a new repository manager
    // is needed
    zypp::RepoManager *new_repo_manager =
        new zypp::RepoManager(repo_manager_options);

    // replace the old repository manager
    if (the_zypp.repo_manager)
      delete the_zypp.repo_manager;
    the_zypp.repo_manager = new_repo_manager;

    // TODO: localization
    if (progress != NULL)
      progress("Initializing the Target System", 0, 2, user_data);
    the_zypp.zypp_pointer = zypp_ptr();
    zypp = &the_zypp;
    zypp->zypp_pointer->initializeTarget(root_str, false);
    if (progress != NULL)
      progress("Reading Installed Packages", 1, 2, user_data);
    zypp->zypp_pointer->target()->load();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    the_zypp.zypp_pointer = NULL;
    return NULL;
  }

  STATUS_OK(status);
  return zypp;
}

void free_repository(struct Repository *repo) {
  free(repo->url);
  free(repo->alias);
  free(repo->userName);
}

void free_repository_list(struct RepositoryList *list) noexcept {
  for (unsigned i = 0; i < list->size; ++i) {
    free_repository(list->repos + i);
  }
  free(list->repos);
}

void free_status(struct Status *status) noexcept {
  if (status->error != NULL) {
    free(status->error);
    status->error = NULL;
  }
}

static zypp::Resolvable::Kind kind_to_zypp_kind(RESOLVABLE_KIND kind) {
  switch (kind) {
  case RESOLVABLE_PACKAGE:
    return zypp::Resolvable::Kind::package;
  case RESOLVABLE_SRCPACKAGE:
    return zypp::Resolvable::Kind::srcpackage;
  case RESOLVABLE_PATTERN:
    return zypp::Resolvable::Kind::pattern;
  case RESOLVABLE_PRODUCT:
    return zypp::Resolvable::Kind::product;
  case RESOLVABLE_PATCH:
    return zypp::Resolvable::Kind::patch;
  }
  PANIC("Unhandled case in resolvable kind switch %i", kind);
}

static zypp::ResStatus::TransactByValue
transactby_from(enum RESOLVABLE_SELECTED who) {
  switch (who) {
  case RESOLVABLE_SELECTED::SOLVER_SELECTED:
    return zypp::ResStatus::SOLVER;
  case RESOLVABLE_SELECTED::APPLICATION_SELECTED:
    return zypp::ResStatus::APPL_HIGH;
  case RESOLVABLE_SELECTED::USER_SELECTED:
    return zypp::ResStatus::USER;
  case RESOLVABLE_SELECTED::NOT_SELECTED: {
    PANIC("Unexpected value RESOLVABLE_SELECTED::NOT_SELECTED.");
  }
  }

  // should not happen
  PANIC("Unexpected RESOLVABLE_SELECT value %i", who);
}

void resolvable_select(struct Zypp *_zypp, const char *name,
                       enum RESOLVABLE_KIND kind, enum RESOLVABLE_SELECTED who,
                       struct Status *status) noexcept {
  if (who == RESOLVABLE_SELECTED::NOT_SELECTED) {
    STATUS_OK(status);
    return;
  }

  zypp::Resolvable::Kind z_kind = kind_to_zypp_kind(kind);
  auto selectable = zypp::ui::Selectable::get(z_kind, name);
  if (!selectable) {
    STATUS_ERROR(status, "Failed to find %s with name '%s'", z_kind.c_str(),
                 name);
    return;
  }

  STATUS_OK(status);
  auto value = transactby_from(who);
  selectable->setToInstall(value);
}

void resolvable_unselect(struct Zypp *_zypp, const char *name,
                         enum RESOLVABLE_KIND kind,
                         enum RESOLVABLE_SELECTED who,
                         struct Status *status) noexcept {
  STATUS_OK(status);
  if (who == RESOLVABLE_SELECTED::NOT_SELECTED) {
    return;
  }

  zypp::Resolvable::Kind z_kind = kind_to_zypp_kind(kind);
  auto selectable = zypp::ui::Selectable::get(z_kind, name);
  if (!selectable) {
    STATUS_ERROR(status, "Failed to find %s with name '%s'", z_kind.c_str(),
                 name);
    return;
  }

  auto value = transactby_from(who);
  selectable->unset(value);
}

struct PatternInfos get_patterns_info(struct Zypp *_zypp,
                                      struct PatternNames names,
                                      struct Status *status) noexcept {
  PatternInfos result = {
      (struct PatternInfo *)malloc(names.size * sizeof(PatternInfo)),
      0 // initialize with zero and increase after each successfull add of
        // pattern info
  };

  for (unsigned j = 0; j < names.size; ++j) {
    zypp::ui::Selectable::constPtr selectable =
        zypp::ui::Selectable::get(zypp::ResKind::pattern, names.names[j]);
    // we do not find any pattern
    if (!selectable.get())
      continue;

    // we know here that we get only patterns
    zypp::Pattern::constPtr pattern =
        zypp::asKind<zypp::Pattern>(selectable->theObj().resolvable());
    unsigned i = result.size;
    result.infos[i].name = strdup(pattern->name().c_str());
    result.infos[i].category = strdup(pattern->category().c_str());
    result.infos[i].description = strdup(pattern->description().c_str());
    result.infos[i].icon = strdup(pattern->icon().c_str());
    result.infos[i].summary = strdup(pattern->summary().c_str());
    result.infos[i].order = strdup(pattern->order().c_str());
    auto &status = selectable->theObj().status();
    if (status.isToBeInstalled()) {
      switch (status.getTransactByValue()) {
      case zypp::ResStatus::TransactByValue::USER:
        result.infos[i].selected = RESOLVABLE_SELECTED::USER_SELECTED;
        break;
      case zypp::ResStatus::TransactByValue::APPL_HIGH:
      case zypp::ResStatus::TransactByValue::APPL_LOW:
        result.infos[i].selected = RESOLVABLE_SELECTED::APPLICATION_SELECTED;
        break;
      case zypp::ResStatus::TransactByValue::SOLVER:
        result.infos[i].selected = RESOLVABLE_SELECTED::SOLVER_SELECTED;
        break;
      }
    } else {
      result.infos[i].selected = RESOLVABLE_SELECTED::NOT_SELECTED;
    }
    result.size++;
  };

  STATUS_OK(status);
  return result;
}

void free_pattern_infos(const struct PatternInfos *infos) noexcept {
  for (unsigned i = 0; i < infos->size; ++i) {
    free(infos->infos[i].name);
    free(infos->infos[i].category);
    free(infos->infos[i].icon);
    free(infos->infos[i].description);
    free(infos->infos[i].summary);
    free(infos->infos[i].order);
  }
  free(infos->infos);
}

bool run_solver(struct Zypp *zypp, struct Status *status) noexcept {
  try {
    STATUS_OK(status);
    return zypp->zypp_pointer->resolver()->resolvePool();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return false; // do not matter much as status indicate failure
  }
}

void refresh_repository(struct Zypp *zypp, const char *alias,
                        struct Status *status,
                        struct DownloadProgressCallbacks *callbacks) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::RepoInfo zypp_repo = zypp->repo_manager->getRepo(alias);
    if (zypp_repo == zypp::RepoInfo::noRepo) {
      STATUS_ERROR(status, "Cannot refresh repo with alias %s. Repo not found.",
                   alias);
      return;
    }

    set_zypp_download_callbacks(callbacks);
    zypp->repo_manager->refreshMetadata(
        zypp_repo,
        zypp::RepoManager::RawMetadataRefreshPolicy::RefreshIfNeeded);
    STATUS_OK(status);
    unset_zypp_download_callbacks();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    unset_zypp_download_callbacks(); // TODO: we can add C++ final action helper
                                     // if it is more common
  }
}

bool is_local_url(const char *url, struct Status *status) noexcept {
  try {
    zypp::Url z_url(url);
    STATUS_OK(status);
    return z_url.schemeIsLocal();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return false;
  }
}

static bool package_check(Zypp *zypp, const char *tag, bool selected,
                          Status *status) noexcept {
  try {
    std::string s_tag(tag);
    if (s_tag.empty()) {
      STATUS_ERROR(status, "Internal Error: Package tag is empty.");
      return false;
    }

    // look for packages
    zypp::Capability cap(s_tag, zypp::ResKind::package);
    zypp::sat::WhatProvides possibleProviders(cap);

    // if we check only for availability, then just check that quickly
    if (!selected)
      return !possibleProviders.empty();

    for (auto iter = possibleProviders.begin(); iter != possibleProviders.end();
         ++iter) {
      zypp::PoolItem provider = zypp::ResPool::instance().find(*iter);
      // is it installed? if so return true, otherwise check next candidate
      if (provider.status().isToBeInstalled())
        return true;
    }

    return false;
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return false;
  }
}

bool is_package_available(Zypp *zypp, const char *tag,
                          Status *status) noexcept {
  return package_check(zypp, tag, false, status);
}

bool is_package_selected(Zypp *zypp, const char *tag, Status *status) noexcept {
  return package_check(zypp, tag, true, status);
}

void add_repository(struct Zypp *zypp, const char *alias, const char *url,
                    struct Status *status, ZyppProgressCallback callback,
                    void *user_data) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    auto zypp_callback = create_progress_callback(callback, user_data);
    zypp::RepoInfo zypp_repo = zypp::RepoInfo();
    zypp_repo.setBaseUrl(zypp::Url(url));
    zypp_repo.setAlias(alias);

    zypp->repo_manager->addRepository(zypp_repo, zypp_callback);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void disable_repository(struct Zypp *zypp, const char *alias,
                        struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::RepoInfo r_info = zypp->repo_manager->getRepo(alias);
    r_info.setEnabled(false);
    zypp->repo_manager->modifyRepository(r_info);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void set_repository_url(struct Zypp *zypp, const char *alias, const char *url,
                        struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::RepoInfo r_info = zypp->repo_manager->getRepo(alias);
    zypp::Url z_url(url);
    r_info.setBaseUrl(z_url);
    zypp->repo_manager->modifyRepository(r_info);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void remove_repository(struct Zypp *zypp, const char *alias,
                       struct Status *status, ZyppProgressCallback callback,
                       void *user_data) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    auto zypp_callback = create_progress_callback(callback, user_data);
    zypp::RepoInfo zypp_repo = zypp::RepoInfo();
    zypp_repo.setAlias(alias); // alias should be unique, so it should always
                               // match correct repo

    zypp->repo_manager->removeRepository(zypp_repo, zypp_callback);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

struct RepositoryList list_repositories(struct Zypp *zypp,
                                        struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return {0, NULL};
  }

  std::list<zypp::RepoInfo> zypp_repos =
      zypp->repo_manager->knownRepositories();
  const std::list<zypp::RepoInfo>::size_type size = zypp_repos.size();
  struct Repository *repos =
      (struct Repository *)malloc(size * sizeof(struct Repository));
  // TODO: error handling
  unsigned res_i = 0;
  for (auto iter = zypp_repos.begin(); iter != zypp_repos.end(); ++iter) {
    struct Repository *new_repo = repos + res_i++;
    new_repo->enabled = iter->enabled();
    new_repo->url = strdup(iter->url().asString().c_str());
    new_repo->alias = strdup(iter->alias().c_str());
    new_repo->userName = strdup(iter->asUserString().c_str());
  }

  struct RepositoryList result = {static_cast<unsigned>(size), repos};
  STATUS_OK(status);
  return result;
}

void load_repository_cache(struct Zypp *zypp, const char *alias,
                           struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
  }
  try {
    zypp::RepoInfo zypp_repo = zypp->repo_manager->getRepo(alias);
    if (zypp_repo == zypp::RepoInfo::noRepo) {
      STATUS_ERROR(status, "Cannot load repo with alias %s. Repo not found.",
                   alias);
      return;
    }

    // NOTE: loadFromCache has an optional `progress` parameter but it ignores
    // it anyway
    zypp->repo_manager->loadFromCache(zypp_repo);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void build_repository_cache(struct Zypp *zypp, const char *alias,
                            struct Status *status,
                            ZyppProgressCallback callback,
                            void *user_data) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::RepoInfo zypp_repo = zypp->repo_manager->getRepo(alias);
    if (zypp_repo == zypp::RepoInfo::noRepo) {
      STATUS_ERROR(status, "Cannot load repo with alias %s. Repo not found.",
                   alias);
      return;
    }

    auto progress = create_progress_callback(callback, user_data);
    zypp->repo_manager->buildCache(
        zypp_repo, zypp::RepoManagerFlags::BuildIfNeeded, progress);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void import_gpg_key(struct Zypp *zypp, const char *const pathname,
                    struct Status *status) noexcept {
  try {
    zypp::filesystem::Pathname path(pathname);
    zypp::PublicKey key(path);
    // Keys that are unknown (not imported).
    // or known-but-untrusted (weird in-between state, see KeyRing_test.cc)
    // will trigger "Trust this?" callbacks.
    bool trusted = true;
    zypp->zypp_pointer->keyRing()->importKey(key, trusted);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}
}
