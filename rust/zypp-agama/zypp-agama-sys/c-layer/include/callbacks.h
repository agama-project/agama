#ifndef C_CALLBACKS_H_
#define C_CALLBACKS_H_

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

struct ProgressData {
  // TODO: zypp also reports min/max so it can be either percent, min/max or
  // just alive progress. Should we expose all of them? progress value is either
  // percent or -1 which means just keep alive progress
  long long value;
  // pointer to progress name. Owned by zypp, so lives only as long as callback
  const char *name;
};

// Progress reporting callback passed to libzypp.
// zypp_data is ProgressData get from zypp
// user_data is never touched by method and is used only to pass local data for
// callback
/// @return true to continue, false to abort. Can be ignored
typedef bool (*ZyppProgressCallback)(struct ProgressData zypp_data,
                                     void *user_data);
void set_zypp_progress_callback(ZyppProgressCallback progress, void *user_data);

enum PROBLEM_RESPONSE { PROBLEM_RETRY, PROBLEM_ABORT, PROBLEM_IGNORE };
typedef void (*ZyppDownloadStartCallback)(const char *url,
                                          const char *localfile,
                                          void *user_data);
typedef bool (*ZyppDownloadProgressCallback)(int value, const char *url,
                                             double bps_avg, double bps_current,
                                             void *user_data);
typedef enum PROBLEM_RESPONSE (*ZyppDownloadProblemCallback)(
    const char *url, int error, const char *description, void *user_data);
typedef void (*ZyppDownloadFinishCallback)(const char *url, int error,
                                           const char *reason, void *user_data);

// progress for downloading files. There are 4 callbacks:
// 1. start for start of download
// 2. progress to see how it goes
// 3. problem to react when something wrong happen and how to behave
// 4. finish when download finishes
// NOTE: user_data is separated for each call.
struct DownloadProgressCallbacks {
  ZyppDownloadStartCallback start;
  void *start_data;
  ZyppDownloadProgressCallback progress;
  void *progress_data;
  ZyppDownloadProblemCallback problem;
  void *problem_data;
  ZyppDownloadFinishCallback finish;
  void *finish_data;
};
#ifdef __cplusplus
}
#endif
#endif
