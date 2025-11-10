#include <boost/bind.hpp>
#include <zypp/Callback.h>
#include <zypp/ZYppCallbacks.h>
#include "zypp/target/rpm/RpmDb.h"

#include "callbacks.h"

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
  virtual void start(const zypp::ProgressData &task) {
    if (callback != NULL) {
      ProgressData data = {task.reportValue(), task.name().c_str()};
      callback(data, user_data);
    }
  }

  bool progress(const zypp::ProgressData &task) {
    if (callback != NULL) {
      ProgressData data = {task.reportValue(), task.name().c_str()};
      return callback(data, user_data);
    } else {
      return zypp::ProgressReport::progress(task);
    }
  }

  virtual void finish(const zypp::ProgressData &task) {
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
  struct DownloadProgressCallbacks *callbacks;

  DownloadProgressReceive() { callbacks = NULL; }

  void set_callbacks(DownloadProgressCallbacks *callbacks_) {
    callbacks = callbacks_;
  }

  virtual void start(const zypp::Url &file, zypp::Pathname localfile) {
    last_reported = 0;
    last_reported_time = time(NULL);

    if (callbacks != NULL && callbacks->start != NULL) {
      callbacks->start(file.asString().c_str(), localfile.c_str(),
                       callbacks->start_data);
    }
  }

  virtual bool progress(int value, const zypp::Url &file, double bps_avg,
                        double bps_current) {
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

  virtual Action problem(const zypp::Url &file,
                         zypp::media::DownloadProgressReport::Error error,
                         const std::string &description) {
    if (callbacks != NULL && callbacks->problem != NULL) {
      PROBLEM_RESPONSE response =
          callbacks->problem(file.asString().c_str(), error,
                             description.c_str(), callbacks->problem_data);

      switch (response) {
      case PROBLEM_RETRY:
        return zypp::media::DownloadProgressReport::RETRY;
      case PROBLEM_ABORT:
        return zypp::media::DownloadProgressReport::ABORT;
      case PROBLEM_IGNORE:
        return zypp::media::DownloadProgressReport::IGNORE;
      }
    }
    // otherwise return the default value from the parent class
    return zypp::media::DownloadProgressReport::problem(file, error,
                                                        description);
  }

  virtual void finish(const zypp::Url &file,
                      zypp::media::DownloadProgressReport::Error error,
                      const std::string &reason) {
    if (callbacks != NULL && callbacks->finish != NULL) {
      callbacks->finish(file.asString().c_str(), error, reason.c_str(),
                        callbacks->finish_data);
    }
  }
};

static DownloadProgressReceive download_progress_receive;

struct DownloadResolvableReport : public zypp::callback::ReceiveReport<
                                      zypp::repo::DownloadResolvableReport> {
  struct DownloadResolvableCallbacks *callbacks;

  DownloadResolvableReport() { callbacks = NULL; }

  void set_callbacks(DownloadResolvableCallbacks *callbacks_) {
    callbacks = callbacks_;
  }

  virtual Action problem(zypp::Resolvable::constPtr resolvable_ptr, Error error,
                         const std::string &description) {
    if (callbacks != NULL && callbacks->problem != NULL) {
      enum DownloadResolvableError error_enum;
      switch (error) {
      case zypp::repo::DownloadResolvableReport::NO_ERROR:
        error_enum = DownloadResolvableError::DRE_NO_ERROR;
        break;
      case zypp::repo::DownloadResolvableReport::NOT_FOUND:
        error_enum = DownloadResolvableError::DRE_NOT_FOUND;
        break;
      case zypp::repo::DownloadResolvableReport::IO:
        error_enum = DownloadResolvableError::DRE_IO;
        break;
      case zypp::repo::DownloadResolvableReport::INVALID:
        error_enum = DownloadResolvableError::DRE_INVALID;
        break;
      }
      PROBLEM_RESPONSE response =
          callbacks->problem(resolvable_ptr->name().c_str(), error_enum,
                             description.c_str(), callbacks->problem_data);

      switch (response) {
      case PROBLEM_RETRY:
        return zypp::repo::DownloadResolvableReport::RETRY;
      case PROBLEM_ABORT:
        return zypp::repo::DownloadResolvableReport::ABORT;
      case PROBLEM_IGNORE:
        return zypp::repo::DownloadResolvableReport::IGNORE;
      }
    }
    // otherwise return the default value from the parent class
    return zypp::repo::DownloadResolvableReport::problem(resolvable_ptr, error,
                                                         description);
  }

  virtual void pkgGpgCheck(const UserData & userData_r = UserData() )
    {
      if (callbacks == NULL || callbacks->gpg_check == NULL) {
        return;
      }
      zypp::ResObject::constPtr resobject = userData_r.get<zypp::ResObject::constPtr>("ResObject");
      const zypp::RepoInfo repo = resobject->repoInfo();
      const std::string repo_url = repo.rawUrl().asString();
      typedef zypp::target::rpm::RpmDb RpmDb;
      enum GPGCheckPackageResult result;
      switch (userData_r.get<RpmDb::CheckPackageResult>("CheckPackageResult")){
        case RpmDb::CHK_OK:
          result = GPGCheckPackageResult::CHK_OK;
          break;
          case RpmDb::CHK_NOTFOUND:
          result = GPGCheckPackageResult::CHK_NOTFOUND;
          break;
          case RpmDb::CHK_FAIL:
          result = GPGCheckPackageResult::CHK_FAIL;
          break;
          case RpmDb::CHK_NOTTRUSTED:
          result = GPGCheckPackageResult::CHK_NOTTRUSTED;
          break;
          case RpmDb::CHK_NOKEY:
          result = GPGCheckPackageResult::CHK_NOKEY;
          break;
          case RpmDb::CHK_ERROR:
          result = GPGCheckPackageResult::CHK_ERROR;
          break;
          case RpmDb::CHK_NOSIG:
          result = GPGCheckPackageResult::CHK_NOSIG;
          break;
      };
      PROBLEM_RESPONSE response = callbacks->gpg_check(resobject->name().c_str(), repo_url.c_str(), result, callbacks->gpg_check_data);
      DownloadResolvableReport::Action zypp_action;
      switch (response) {
        case PROBLEM_RETRY:
          zypp_action = zypp::repo::DownloadResolvableReport::RETRY;
          break;
        case PROBLEM_ABORT:
          zypp_action = zypp::repo::DownloadResolvableReport::ABORT;
          break;
        case PROBLEM_IGNORE:
          zypp_action = zypp::repo::DownloadResolvableReport::IGNORE;
          break;
      };
      userData_r.set("Action", zypp_action);
    }
};

static DownloadResolvableReport download_resolvable_receive;

struct CommitPreloadReport
    : public zypp::callback::ReceiveReport<zypp::media::CommitPreloadReport> {

  struct DownloadResolvableCallbacks *callbacks;

  CommitPreloadReport() { callbacks = NULL; }

  void set_callbacks(DownloadResolvableCallbacks *callbacks_) {
    callbacks = callbacks_;
  }
  virtual void start(const UserData &userData = UserData()) {
    if (callbacks != NULL && callbacks->start_preload != NULL) {
      callbacks->start_preload(callbacks->start_preload_data);
    }
  }

  virtual void fileDone(const zypp::Pathname &localfile, Error error,
                        const UserData &userData = UserData()) {
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
      enum DownloadResolvableFileError error_enum;
      switch (error) {
      case zypp::media::CommitPreloadReport::NO_ERROR:
        error_enum = DownloadResolvableFileError::DRFE_NO_ERROR;
        break;
      case zypp::media::CommitPreloadReport::NOT_FOUND:
        error_enum = DownloadResolvableFileError::DRFE_NOT_FOUND;
        break;
      case zypp::media::CommitPreloadReport::IO:
        error_enum = DownloadResolvableFileError::DRFE_IO;
        break;
      case zypp::media::CommitPreloadReport::ACCESS_DENIED:
        error_enum = DownloadResolvableFileError::DRFE_ACCESS_DENIED;
        break;
      case zypp::media::CommitPreloadReport::ERROR:
        error_enum = DownloadResolvableFileError::DRFE_ERROR;
        break;
      }
      callbacks->file_finish(url, local_path, error_enum, error_details,
                             callbacks->file_finish_data);
    }
  }
};

static CommitPreloadReport commit_preload_report;

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
