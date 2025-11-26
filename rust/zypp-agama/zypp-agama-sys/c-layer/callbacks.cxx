#include "zypp/Digest.h"
#include "zypp/target/rpm/RpmDb.h"
#include <boost/bind/bind.hpp>
#include <zypp/Callback.h>
#include <zypp/ZYppCallbacks.h>

#include "callbacks.h"

// _1
using namespace boost::placeholders;

struct ProgressReceive : zypp::callback::ReceiveReport<zypp::ProgressReport> {
  ZyppProgressCallback callback;
  void *user_data;

  ProgressReceive() {}

  void set_callback(ZyppProgressCallback callback_, void *user_data_) {
    callback = callback_;
    user_data = user_data_;
  }

  // TODO: should we distinguish start/finish? and if so, is enum param to
  // callback enough instead of having three callbacks?
  void start(const zypp::ProgressData &task) override {
    if (callback != NULL) {
      ProgressData data = {task.reportValue(), task.name().c_str()};
      callback(data, user_data);
    }
  }

  bool progress(const zypp::ProgressData &task) override {
    if (callback != NULL) {
      ProgressData data = {task.reportValue(), task.name().c_str()};
      return callback(data, user_data);
    } else {
      return zypp::ProgressReport::progress(task);
    }
  }

  void finish(const zypp::ProgressData &task) override {
    if (callback != NULL) {
      ProgressData data = {task.reportValue(), task.name().c_str()};
      callback(data, user_data);
    }
  }
};

static ProgressReceive progress_receive;

struct DownloadProgressReceive : public zypp::callback::ReceiveReport<
                                     zypp::media::DownloadProgressReport> {
  int last_reported;
  time_t last_reported_time;
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct DownloadProgressCallbacks *callbacks;

  DownloadProgressReceive() { callbacks = NULL; }

  void set_callbacks(DownloadProgressCallbacks *callbacks_) {
    callbacks = callbacks_;
  }

  void start(const zypp::Url &file, zypp::Pathname localfile) override {
    last_reported = 0;
    last_reported_time = time(NULL);

    if (callbacks != NULL && callbacks->start != NULL) {
      callbacks->start(file.asString().c_str(), localfile.c_str(),
                       callbacks->start_data);
    }
  }

  bool progress(int value, const zypp::Url &file, double bps_avg,
                double bps_current) override {
    // call the callback function only if the difference since the last call is
    // at least 5% or if 100% is reached or if at least 3 seconds have elapsed
    time_t current_time = time(NULL);
    const int timeout = 3;
    if (callbacks != NULL && callbacks->progress != NULL &&
        (value - last_reported >= 5 || last_reported - value >= 5 ||
         value == 100 || current_time - last_reported_time >= timeout)) {
      last_reported = value;
      last_reported_time = current_time;
      // report changed values
      return callbacks->progress(value, file.asString().c_str(), bps_avg,
                                 bps_current, callbacks->progress_data) != 0;
    }

    return true;
  }

  Action problem(const zypp::Url &file,
                 zypp::media::DownloadProgressReport::Error error,
                 const std::string &description) override {
    if (callbacks != NULL && callbacks->problem != NULL) {
      PROBLEM_RESPONSE response =
          callbacks->problem(file.asString().c_str(), into_error(error),
                             description.c_str(), callbacks->problem_data);

      return into_action(response);
    }
    // otherwise return the default value from the parent class
    return zypp::media::DownloadProgressReport::problem(file, error,
                                                        description);
  }

  void finish(const zypp::Url &file,
              zypp::media::DownloadProgressReport::Error error,
              const std::string &reason) override {
    if (callbacks != NULL && callbacks->finish != NULL) {
      callbacks->finish(file.asString().c_str(), into_error(error),
                        reason.c_str(), callbacks->finish_data);
    }
  }

private:
  inline DownloadProgressError
  into_error(zypp::media::DownloadProgressReport::Error error) noexcept {
    switch (error) {
    case zypp::media::DownloadProgressReport::NO_ERROR:
      return DPE_NO_ERROR;
    case zypp::media::DownloadProgressReport::NOT_FOUND:
      return DPE_NOT_FOUND;
    case zypp::media::DownloadProgressReport::IO:
      return DPE_IO;
    case zypp::media::DownloadProgressReport::ACCESS_DENIED:
      return DPE_ACCESS_DENIED;
    case zypp::media::DownloadProgressReport::ERROR:
      return DPE_ERROR;
    }
    return DPE_ERROR;
  }

  inline zypp::media::DownloadProgressReport::Action
  into_action(PROBLEM_RESPONSE response) {
    switch (response) {
    case PROBLEM_RETRY:
      return zypp::media::DownloadProgressReport::RETRY;
    case PROBLEM_ABORT:
      return zypp::media::DownloadProgressReport::ABORT;
    case PROBLEM_IGNORE:
      return zypp::media::DownloadProgressReport::IGNORE;
    }
    return zypp::media::DownloadProgressReport::ABORT;
  }
};

static DownloadProgressReceive download_progress_receive;

struct DownloadResolvableReport : public zypp::callback::ReceiveReport<
                                      zypp::repo::DownloadResolvableReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct DownloadResolvableCallbacks *callbacks;

  DownloadResolvableReport() { callbacks = NULL; }

  void set_callbacks(DownloadResolvableCallbacks *callbacks_) {
    callbacks = callbacks_;
  }

  Action problem(zypp::Resolvable::constPtr resolvable_ptr, Error error,
                 const std::string &description) override {
    // return the default value from the parent class if not defined
    if (callbacks == NULL || callbacks->problem == NULL)
      return zypp::repo::DownloadResolvableReport::problem(resolvable_ptr,
                                                           error, description);

    PROBLEM_RESPONSE response =
        callbacks->problem(resolvable_ptr->name().c_str(), into_error(error),
                           description.c_str(), callbacks->problem_data);
    return into_action(response);
  }

  void pkgGpgCheck(const UserData &userData_r = UserData()) override {
    if (callbacks == NULL || callbacks->gpg_check == NULL) {
      return;
    }
    zypp::ResObject::constPtr resobject =
        userData_r.get<zypp::ResObject::constPtr>("ResObject");
    const zypp::RepoInfo repo = resobject->repoInfo();
    const std::string repo_url = repo.rawUrl().asString();
    enum GPGCheckPackageResult result = into_result(
        userData_r.get<zypp::target::rpm::RpmDb::CheckPackageResult>(
            "CheckPackageResult"));
    OPTIONAL_PROBLEM_RESPONSE response =
        callbacks->gpg_check(resobject->name().c_str(), repo_url.c_str(),
                             result, callbacks->gpg_check_data);
    set_response(userData_r, response);
  }

private:
  inline void set_response(const UserData &userData_r,
                           OPTIONAL_PROBLEM_RESPONSE response) {
    DownloadResolvableReport::Action zypp_action;
    switch (response) {
    case OPROBLEM_RETRY:
      zypp_action = zypp::repo::DownloadResolvableReport::RETRY;
      break;
    case OPROBLEM_ABORT:
      zypp_action = zypp::repo::DownloadResolvableReport::ABORT;
      break;
    case OPROBLEM_IGNORE:
      zypp_action = zypp::repo::DownloadResolvableReport::IGNORE;
      break;
    // do not set action and it will let fail it later in Done Provide
    case OPROBLEM_NONE:
      return;
    };
    userData_r.set("Action", zypp_action);
  }

  inline DownloadResolvableError
  into_error(zypp::repo::DownloadResolvableReport::Error error) {
    switch (error) {
    case zypp::repo::DownloadResolvableReport::NO_ERROR:
      return DownloadResolvableError::DRE_NO_ERROR;
    case zypp::repo::DownloadResolvableReport::NOT_FOUND:
      return DownloadResolvableError::DRE_NOT_FOUND;
    case zypp::repo::DownloadResolvableReport::IO:
      return DownloadResolvableError::DRE_IO;
    case zypp::repo::DownloadResolvableReport::INVALID:
      return DownloadResolvableError::DRE_INVALID;
    }
    // fallback that should not happen
    return DownloadResolvableError::DRE_NO_ERROR;
  }

  inline Action into_action(PROBLEM_RESPONSE response) {
    switch (response) {
    case PROBLEM_RETRY:
      return zypp::repo::DownloadResolvableReport::RETRY;
    case PROBLEM_ABORT:
      return zypp::repo::DownloadResolvableReport::ABORT;
    case PROBLEM_IGNORE:
      return zypp::repo::DownloadResolvableReport::IGNORE;
    }
    // fallback that should not happen
    return zypp::repo::DownloadResolvableReport::ABORT;
  }

  inline GPGCheckPackageResult
  into_result(zypp::target::rpm::RpmDb::CheckPackageResult result) {
    switch (result) {
    case zypp::target::rpm::RpmDb::CHK_OK:
      return GPGCheckPackageResult::CHK_OK;
    case zypp::target::rpm::RpmDb::CHK_NOTFOUND:
      return GPGCheckPackageResult::CHK_NOTFOUND;
    case zypp::target::rpm::RpmDb::CHK_FAIL:
      return GPGCheckPackageResult::CHK_FAIL;
    case zypp::target::rpm::RpmDb::CHK_NOTTRUSTED:
      return GPGCheckPackageResult::CHK_NOTTRUSTED;
    case zypp::target::rpm::RpmDb::CHK_NOKEY:
      return GPGCheckPackageResult::CHK_NOKEY;
    case zypp::target::rpm::RpmDb::CHK_ERROR:
      return GPGCheckPackageResult::CHK_ERROR;
    case zypp::target::rpm::RpmDb::CHK_NOSIG:
      return GPGCheckPackageResult::CHK_NOSIG;
    }
    // fallback that should not happen
    return GPGCheckPackageResult::CHK_ERROR;
  }
};

static DownloadResolvableReport download_resolvable_receive;

struct CommitPreloadReport
    : public zypp::callback::ReceiveReport<zypp::media::CommitPreloadReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct DownloadResolvableCallbacks *callbacks;

  CommitPreloadReport() { callbacks = NULL; }

  void set_callbacks(DownloadResolvableCallbacks *callbacks_) {
    callbacks = callbacks_;
  }
  void start(const UserData &userData = UserData()) override {
    if (callbacks != NULL && callbacks->start_preload != NULL) {
      callbacks->start_preload(callbacks->start_preload_data);
    }
  }

  void fileDone(const zypp::Pathname &localfile, Error error,
                const UserData &userData = UserData()) override {
    if (callbacks != NULL && callbacks->file_finish != NULL) {
      const char *url = "";
      if (userData.hasvalue("url")) {
        url = userData.get<zypp::Url>("url").asString().c_str();
      }
      const char *local_path = localfile.c_str();
      const char *error_details = "";
      if (userData.hasvalue("description")) {
        error_details = userData.get<std::string>("description").c_str();
      }
      callbacks->file_finish(url, local_path, into_error(error), error_details,
                             callbacks->file_finish_data);
    }
  }

private:
  inline DownloadResolvableFileError
  into_error(zypp::media::CommitPreloadReport::Error error) {
    switch (error) {
    case zypp::media::CommitPreloadReport::NO_ERROR:
      return DownloadResolvableFileError::DRFE_NO_ERROR;
    case zypp::media::CommitPreloadReport::NOT_FOUND:
      return DownloadResolvableFileError::DRFE_NOT_FOUND;
    case zypp::media::CommitPreloadReport::IO:
      return DownloadResolvableFileError::DRFE_IO;
    case zypp::media::CommitPreloadReport::ACCESS_DENIED:
      return DownloadResolvableFileError::DRFE_ACCESS_DENIED;
    case zypp::media::CommitPreloadReport::ERROR:
      return DownloadResolvableFileError::DRFE_ERROR;
    }
    // fallback that should not happen
    return DownloadResolvableFileError::DRFE_NO_ERROR;
  }
};

static CommitPreloadReport commit_preload_report;

struct KeyRingReport
    : public zypp::callback::ReceiveReport<zypp::KeyRingReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct SecurityCallbacks *callbacks;

  KeyRingReport() { callbacks = NULL; }

  void set_callbacks(SecurityCallbacks *callbacks_) { callbacks = callbacks_; }

  zypp::KeyRingReport::KeyTrust
  askUserToAcceptKey(const zypp::PublicKey &key,
                     const zypp::KeyContext &context) override {
    if (callbacks == NULL || callbacks->accept_key == NULL) {
      return zypp::KeyRingReport::askUserToAcceptKey(key, context);
    }
    enum GPGKeyTrust response = callbacks->accept_key(
        key.id().c_str(), key.name().c_str(), key.fingerprint().c_str(),
        context.repoInfo().alias().c_str(), callbacks->accept_key_data);

    return into_trust(response);
  }

  bool askUserToAcceptUnsignedFile(const std::string &file,
                                   const zypp::KeyContext &context) override {
    if (callbacks == NULL || callbacks->unsigned_file == NULL) {
      return zypp::KeyRingReport::askUserToAcceptUnsignedFile(file, context);
    }
    return callbacks->unsigned_file(file.c_str(),
                                    context.repoInfo().alias().c_str(),
                                    callbacks->unsigned_file_data);
  }

  bool askUserToAcceptUnknownKey(const std::string &file, const std::string &id,
                                 const zypp::KeyContext &context) override {
    if (callbacks == NULL || callbacks->unknown_key == NULL) {
      return zypp::KeyRingReport::askUserToAcceptUnknownKey(file, id, context);
    }
    return callbacks->unknown_key(file.c_str(), id.c_str(),
                                  context.repoInfo().alias().c_str(),
                                  callbacks->unknown_key_data);
  }

  bool
  askUserToAcceptVerificationFailed(const std::string &file,
                                    const zypp::PublicKey &key,
                                    const zypp::KeyContext &context) override {
    if (callbacks == NULL || callbacks->verification_failed == NULL) {
      return zypp::KeyRingReport::askUserToAcceptVerificationFailed(file, key,
                                                                    context);
    }
    return callbacks->verification_failed(
        file.c_str(), key.id().c_str(), key.name().c_str(),
        key.fingerprint().c_str(), context.repoInfo().alias().c_str(),
        callbacks->verification_failed_data);
  }

private:
  inline zypp::KeyRingReport::KeyTrust into_trust(GPGKeyTrust response) {
    switch (response) {
    case GPGKT_REJECT:
      return zypp::KeyRingReport::KEY_DONT_TRUST;
    case GPGKT_TEMPORARY:
      return zypp::KeyRingReport::KEY_TRUST_TEMPORARILY;
    case GPGKT_IMPORT:
      return zypp::KeyRingReport::KEY_TRUST_AND_IMPORT;
    }
    // fallback that should not happen
    return zypp::KeyRingReport::KEY_DONT_TRUST;
  }
};

static KeyRingReport key_ring_report;

struct DigestReceive
    : public zypp::callback::ReceiveReport<zypp::DigestReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct SecurityCallbacks *callbacks;

  DigestReceive() { callbacks = NULL; }

  void set_callbacks(SecurityCallbacks *callbacks_) { callbacks = callbacks_; }

  bool askUserToAcceptNoDigest(const zypp::Pathname &file) override {
    if (callbacks == NULL || callbacks->checksum_missing == NULL) {
      return zypp::DigestReport::askUserToAcceptNoDigest(file);
    }
    return callbacks->checksum_missing(file.c_str(),
                                       callbacks->checksum_missing_data);
  }

  bool askUserToAccepUnknownDigest(const zypp::Pathname &file,
                                   const std::string &name) override {
    if (callbacks == NULL || callbacks->checksum_unknown == NULL) {
      return zypp::DigestReport::askUserToAccepUnknownDigest(file, name);
    }
    return callbacks->checksum_unknown(file.c_str(), name.c_str(),
                                       callbacks->checksum_unknown_data);
  }

  bool askUserToAcceptWrongDigest(const zypp::Pathname &file,
                                  const std::string &requested,
                                  const std::string &found) override {
    if (callbacks == NULL || callbacks->checksum_wrong == NULL) {
      return zypp::DigestReport::askUserToAcceptWrongDigest(file, requested,
                                                            found);
    }
    return callbacks->checksum_wrong(file.c_str(), requested.c_str(),
                                     found.c_str(),
                                     callbacks->checksum_wrong_data);
  }
};

static DigestReceive digest_receive;

struct PatchScriptReport
    : public zypp::callback::ReceiveReport<zypp::target::PatchScriptReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct InstallCallbacks *callbacks;

  PatchScriptReport() { callbacks = NULL; }

  void set_callbacks(InstallCallbacks *callbacks_) { callbacks = callbacks_; }

  zypp::target::PatchScriptReport::Action
  problem(const std::string &description) override {
    if (callbacks == NULL || callbacks->script_problem == NULL) {
      return zypp::target::PatchScriptReport::problem(description);
    }
    PROBLEM_RESPONSE response = callbacks->script_problem(
        description.c_str(), callbacks->script_problem_data);
    return into_action(response);
  }

private:
  inline zypp::target::PatchScriptReport::Action
  into_action(PROBLEM_RESPONSE response) {
    switch (response) {
    case PROBLEM_RETRY:
      return zypp::target::PatchScriptReport::RETRY;
    case PROBLEM_ABORT:
      return zypp::target::PatchScriptReport::ABORT;
    case PROBLEM_IGNORE:
      return zypp::target::PatchScriptReport::IGNORE;
    }
    // fallback that should not happen
    return zypp::target::PatchScriptReport::ABORT;
  }
};

static PatchScriptReport patch_script_report;

struct InstallResolvableReport
    : public zypp::callback::ReceiveReport<
          zypp::target::rpm::InstallResolvableReport> {
  // lifetime of pointer is quite short. Only during operation which takes
  // callbacks as parameter.
  struct InstallCallbacks *callbacks;

  InstallResolvableReport() { callbacks = NULL; }

  void set_callbacks(InstallCallbacks *callbacks_) { callbacks = callbacks_; }

  void start(zypp::Resolvable::constPtr resolvable) override {
    if (callbacks == NULL || callbacks->package_start == NULL) {
      return;
    }
    callbacks->package_start(resolvable->name().c_str(),
                             callbacks->package_start_data);
  }

  Action problem(
      zypp::Resolvable::constPtr resolvable,
      zypp::target::rpm::InstallResolvableReport::Error error,
      const std::string &description,
      // note: the RpmLevel argument is not used anymore, ignore it
      zypp::target::rpm::InstallResolvableReport::RpmLevel _level) override {
    if (callbacks == NULL || callbacks->package_problem == NULL) {
      return zypp::target::rpm::InstallResolvableReport::problem(
          resolvable, error, description, _level);
    }
    PROBLEM_RESPONSE response = callbacks->package_problem(
        resolvable->name().c_str(), into_error(error), description.c_str(),
        callbacks->package_problem_data);
    return into_action(response);
  }

  void finish(
      zypp::Resolvable::constPtr resolvable, Error error,
      const std::string &install_info,
      zypp::target::rpm::InstallResolvableReport::RpmLevel /*level*/) override {
    if (callbacks == NULL || callbacks->package_finish == NULL) {
      return;
    }
    callbacks->package_finish(resolvable->name().c_str(),
                              callbacks->package_finish_data);
  }

private:
  inline ZyppInstallPackageError
  into_error(zypp::target::rpm::InstallResolvableReport::Error error) {
    switch (error) {
    case zypp::target::rpm::InstallResolvableReport::Error::NO_ERROR:
      return ZyppInstallPackageError::PI_NO_ERROR;
    case zypp::target::rpm::InstallResolvableReport::Error::NOT_FOUND:
      return ZyppInstallPackageError::PI_NOT_FOUND;
    case zypp::target::rpm::InstallResolvableReport::Error::IO:
      return ZyppInstallPackageError::PI_IO;
    case zypp::target::rpm::InstallResolvableReport::Error::INVALID:
      return ZyppInstallPackageError::PI_INVALID;
    }
    return ZyppInstallPackageError::PI_NO_ERROR;
  }

  inline zypp::target::rpm::InstallResolvableReport::Action
  into_action(PROBLEM_RESPONSE response) {
    switch (response) {
    case PROBLEM_RETRY:
      return zypp::target::rpm::InstallResolvableReport::RETRY;
    case PROBLEM_ABORT:
      return zypp::target::rpm::InstallResolvableReport::ABORT;
    case PROBLEM_IGNORE:
      return zypp::target::rpm::InstallResolvableReport::IGNORE;
    }
    // fallback that should not happen
    return zypp::target::rpm::InstallResolvableReport::ABORT;
  }
};

static InstallResolvableReport install_resolvable_report;

extern "C" {
void set_zypp_progress_callback(ZyppProgressCallback progress,
                                void *user_data) {
  progress_receive.set_callback(progress, user_data);
  progress_receive.connect();
}
}

void set_zypp_download_callbacks(struct DownloadProgressCallbacks *callbacks) {
  download_progress_receive.set_callbacks(callbacks);
  download_progress_receive.connect();
}

void unset_zypp_download_callbacks() {
  // NULL pointer to struct to be sure it is not called
  download_progress_receive.set_callbacks(NULL);
  download_progress_receive.disconnect();
}

// Sets both reports as we consolidate download resolvables
// and commitPreload into one set for easier hooking
void set_zypp_resolvable_download_callbacks(
    struct DownloadResolvableCallbacks *callbacks) {
  download_resolvable_receive.set_callbacks(callbacks);
  download_resolvable_receive.connect();
  commit_preload_report.set_callbacks(callbacks);
  commit_preload_report.connect();
}

void unset_zypp_resolvable_download_callbacks() {
  // NULL pointer to struct to be sure it is not called
  download_resolvable_receive.set_callbacks(NULL);
  download_resolvable_receive.disconnect();
  commit_preload_report.set_callbacks(NULL);
  commit_preload_report.disconnect();
}

void set_zypp_security_callbacks(struct SecurityCallbacks *callbacks) {
  key_ring_report.set_callbacks(callbacks);
  key_ring_report.connect();
  digest_receive.set_callbacks(callbacks);
  digest_receive.connect();
}

void unset_zypp_security_callbacks() {
  // NULL pointer to struct to be sure it is not called
  key_ring_report.set_callbacks(NULL);
  key_ring_report.disconnect();
  digest_receive.set_callbacks(NULL);
  digest_receive.disconnect();
}

void set_zypp_install_callbacks(struct InstallCallbacks *callbacks) {
  patch_script_report.set_callbacks(callbacks);
  patch_script_report.connect();
  install_resolvable_report.set_callbacks(callbacks);
  install_resolvable_report.connect();
}

void unset_zypp_install_callbacks() {
  patch_script_report.set_callbacks(NULL);
  patch_script_report.disconnect();
  install_resolvable_report.set_callbacks(NULL);
  install_resolvable_report.disconnect();
}

#ifdef __cplusplus
bool dynamic_progress_callback(ZyppProgressCallback progress, void *user_data,
                               const zypp::ProgressData &task) {
  if (progress != NULL) {
    ProgressData data = {task.reportValue(), task.name().c_str()};
    return progress(data, user_data);
  } else {
    return true;
  }
}

zypp::ProgressData::ReceiverFnc
create_progress_callback(ZyppProgressCallback progress, void *user_data) {
  return zypp::ProgressData::ReceiverFnc(
      boost::bind(dynamic_progress_callback, progress, user_data, _1));
}
#endif
