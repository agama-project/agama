#include <boost/bind.hpp>
#include <zypp/Callback.h>
#include <zypp/ZYppCallbacks.h>

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
