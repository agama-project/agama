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
#include <zypp/DiskUsageCounter.h>
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
#define ZYPP_BASE_LOGGER_LOGGROUP "rust-bindings"
#include <zypp/base/LogControl.h>
#include <zypp/base/Logger.h>

#include <zypp/ui/Selectable.h>

extern "C" {

#include <systemd/sd-journal.h>

struct Zypp {
  zypp::ZYpp::Ptr zypp_pointer;
  zypp::RepoManager *repo_manager;
};

static struct Zypp the_zypp {
  .zypp_pointer = NULL, .repo_manager = NULL,
};

// formatter which actually logs the messages to the systemd journal,
// that is a bit hacky but in the logger we receive an already formatted
// message as a single string and it would not be easy to get back the original
// components of the message
struct AgamaFormatter : public zypp::base::LogControl::LineFormater {
  virtual std::string format(const std::string &zypp_group,
                             zypp::base::logger::LogLevel zypp_level,
                             const char *zypp_file, const char *zypp_func,
                             int zypp_line, const std::string &zypp_message) {
    // the systemd/syslog compatible log level
    int level;

    // convert the zypp log level to the systemd/syslog log level
    switch (zypp_level) {
    // for details about the systemd levels see
    // https://www.freedesktop.org/software/systemd/man/latest/sd-daemon.html
    case zypp::base::logger::E_DBG:
      level = LOG_DEBUG;
      break;
    case zypp::base::logger::E_MIL:
      level = LOG_INFO;
      break;
    case zypp::base::logger::E_WAR:
      level = LOG_WARNING;
      break;
    case zypp::base::logger::E_ERR:
      level = LOG_ERR;
      break;
    case zypp::base::logger::E_SEC:
      // security error => critical
      level = LOG_CRIT;
      break;
    case zypp::base::logger::E_INT:
      // internal error => critical
      level = LOG_CRIT;
      break;
    // libzypp specific level
    case zypp::base::logger::E_USR:
      level = LOG_INFO;
      break;
    // libzypp specific level
    case zypp::base::logger::E_XXX:
      level = LOG_CRIT;
      break;
    }

    // unlike the other values, the location needs to be sent in an already
    // formatted strings
    std::string file("CODE_FILE=");
    file.append(zypp_file);
    std::string line("CODE_LINE=");
    line.append(std::to_string(zypp_line));

    // this will log the message with libzypp location, not from *this* file,
    // see "man sd_journal_send_with_location"
    sd_journal_send_with_location(
        file.c_str(), line.c_str(), zypp_func, "PRIORITY=%i", level,
        "MESSAGE=[%s] %s", zypp_group.c_str(), zypp_message.c_str(),
        // some custom data to allow easy filtering of the libzypp messages
        "COMPONENT=libzypp", "ZYPP_GROUP=%s", zypp_group.c_str(),
        "ZYPP_LEVEL=%i", zypp_level, NULL);

    // libzypp aborts when the returned message is empty,
    // return some static fake data to make it happy
    return "msg";
  }
};

// a dummy logger
struct AgamaLogger : public zypp::base::LogControl::LineWriter {
  virtual void writeOut(const std::string &formatted) {
    // do nothing, the message has been already logged by the formatter
  }
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
  sd_journal_print(LOG_NOTICE, "Redirecting libzypp logs to systemd journal");

  // log to systemd journal using our specific formatter
  boost::shared_ptr<AgamaFormatter> formatter(new AgamaFormatter);
  zypp::base::LogControl::instance().setLineFormater(formatter);
  // use a dummy logger, using a NULL logger would skip the formatter completely
  // so the messages would not be logged in the end
  boost::shared_ptr<AgamaLogger> logger(new AgamaLogger);
  zypp::base::LogControl::instance().setLineWriter(logger);

  // do not do any magic waiting for lock as in agama context we work
  // on our own root, so there should be no need to wait
  return zypp::getZYpp();
}

void switch_target(struct Zypp *zypp, const char *root,
                   struct Status *status) noexcept {
  const std::string root_str(root);
  try {
    zypp->zypp_pointer->initializeTarget(root_str,
                                         false /* rebuild rpmdb: no */);

    // switch cache for repositories, otherwise we run out of space in tmpfs
    // see
    // https://github.com/yast/yast-pkg-bindings/blob/853496f527543e6d51730fd7e3126ad94b13c303/src/PkgFunctions.cc#L496
    zypp::RepoManagerOptions repo_options(root);
    zypp::Pathname packages_prefix = repo_options.repoPackagesCachePath;

    zypp::ResPool pool = zypp->zypp_pointer->pool();
    for_(it, pool.knownRepositoriesBegin(), pool.knownRepositoriesEnd()) {
      zypp::RepoInfo repo = it->info();
      repo.setPackagesPath(packages_prefix / repo.escaped_alias());

      MIL << "Setting package cache for repository " << repo.alias().c_str()
          << ": " << repo.packagesPath().asString().c_str() << std::endl;

      it->setInfo(repo);
    }
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return;
  }

  STATUS_OK(status);
}

bool commit(struct Zypp *zypp, struct Status *status,
            struct DownloadResolvableCallbacks *download_callbacks,
            struct SecurityCallbacks *security_callbacks,
            struct InstallCallbacks *install_callbacks) noexcept {
  try {
    set_zypp_resolvable_download_callbacks(download_callbacks);
    set_zypp_security_callbacks(security_callbacks);
    set_zypp_install_callbacks(install_callbacks);
    zypp::ZYppCommitPolicy policy;
    // enable preload of rpms to speed up installation
    policy.downloadMode(zypp::DownloadInAdvance);
    zypp::ZYppCommitResult result = zypp->zypp_pointer->commit(policy);
    STATUS_OK(status);
    unset_zypp_resolvable_download_callbacks();
    unset_zypp_security_callbacks();
    unset_zypp_install_callbacks();
    return result.noError();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    unset_zypp_resolvable_download_callbacks();
    unset_zypp_security_callbacks();
    unset_zypp_install_callbacks();
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

  // create the libzypp lock also in the target directory
  setenv("ZYPP_LOCKFILE_ROOT", root, 1 /* allow overwrite */);

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
    if (the_zypp.zypp_pointer == NULL) {
      STATUS_ERROR(status, "Failed to obtain zypp pointer. "
                           "See journalctl for details.");
      return NULL;
    }
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
  free(repo->serviceName);
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
  case RESOLVABLE_SELECTED::USER_REMOVED: {
    PANIC("Unexpected value RESOLVABLE_SELECTED::USER_REMOVED.");
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

void resolvable_reset_all(struct Zypp *_zypp) noexcept {
  MIL << "Resetting status of all resolvables" << std::endl;
  for (auto &item : zypp::ResPool::instance())
    item.statusReset();
}

struct PatternInfos get_patterns_info(struct Zypp *_zypp,
                                      struct PatternNames names,
                                      struct Status *status) noexcept {
  PatternInfos result = {
      (struct PatternInfo *)malloc(names.size * sizeof(PatternInfo)),
      0 // initialize with zero and increase after each successful add of
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
      // distinguish between the "not selected" and "explicitly removed by user"
      // states
      if (status.getTransactByValue() == zypp::ResStatus::TransactByValue::USER)
        result.infos[i].selected = RESOLVABLE_SELECTED::USER_REMOVED;
      else
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

bool run_solver(struct Zypp *zypp, bool only_required,
                struct Status *status) noexcept {
  try {
    STATUS_OK(status);
    if (only_required) {
      zypp->zypp_pointer->resolver()->setOnlyRequires(true);
    } else {
      zypp->zypp_pointer->resolver()->setOnlyRequires(false);
    }
    return zypp->zypp_pointer->resolver()->resolvePool();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    return false; // do not matter much as status indicate failure
  }
}

void add_service(struct Zypp *zypp, const char *alias, const char *url,
                 struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::ServiceInfo zypp_service = zypp::ServiceInfo(alias);
    zypp_service.setUrl(zypp::Url(url));

    zypp->repo_manager->addService(zypp_service);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void refresh_service(struct Zypp *zypp, const char *alias,
                     struct Status *status) noexcept {
  if (zypp->repo_manager == NULL) {
    STATUS_ERROR(status, "Internal Error: Repo manager is not initialized.");
    return;
  }
  try {
    zypp::ServiceInfo service = zypp->repo_manager->getService(alias);
    if (service == zypp::ServiceInfo::noService) {
      STATUS_ERROR(status,
                   "Cannot refresh service with alias %s. Service not found.",
                   alias);
      return;
    }
    zypp->repo_manager->refreshService(service);
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}

void refresh_repository(struct Zypp *zypp, const char *alias,
                        struct Status *status,
                        struct DownloadProgressCallbacks *callbacks,
                        struct SecurityCallbacks *security_callbacks) noexcept {
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
    set_zypp_security_callbacks(security_callbacks);
    zypp->repo_manager->refreshMetadata(
        zypp_repo,
        zypp::RepoManager::RawMetadataRefreshPolicy::RefreshIfNeeded);
    STATUS_OK(status);
    unset_zypp_download_callbacks();
    unset_zypp_security_callbacks();
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
    unset_zypp_security_callbacks();
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

unsigned packages_to_install(struct Zypp *zypp) noexcept {
  return zypp::ResPool::instance()
      .byStatus(&zypp::ResStatus::isToBeInstalled)
      .size();
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
    new_repo->serviceName = strdup(iter->service().c_str());
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

void get_space_usage(struct Zypp *zypp, struct Status *status,
                     struct MountPoint *mount_points,
                     unsigned mount_points_size) noexcept {
  try {
    zypp::DiskUsageCounter::MountPointSet mount_points_set;
    for (unsigned i = 0; i < mount_points_size; ++i) {
      enum zypp::DiskUsageCounter::MountPoint::Hint hint =
          mount_points[i].grow_only
              ? zypp::DiskUsageCounter::MountPoint::Hint::Hint_growonly
              : zypp::DiskUsageCounter::MountPoint::Hint::NoHint;
      zypp::DiskUsageCounter::MountPoint mp(mount_points[i].directory,
                                            mount_points[i].filesystem, 0, 0, 0,
                                            0, hint);
      mount_points_set.insert(mp);
    }
    zypp->zypp_pointer->setPartitions(mount_points_set);
    zypp::DiskUsageCounter::MountPointSet computed_set =
        zypp->zypp_pointer->diskUsage();
    for (unsigned i = 0; i < mount_points_size; ++i) {
      auto mp =
          std::find_if(computed_set.begin(), computed_set.end(),
                       [mount_points, i](zypp::DiskUsageCounter::MountPoint m) {
                         return m.dir == mount_points[i].directory;
                       });
      if (mp == mount_points_set.end()) {
        // mount point not found. Should not happen.
        STATUS_ERROR(status, "Internal Error:Mount point not found.");
        return;
      }
      mount_points[i].used_size = mp->pkg_size;
    }
    STATUS_OK(status);
  } catch (zypp::Exception &excpt) {
    STATUS_EXCEPT(status, excpt);
  }
}
}
