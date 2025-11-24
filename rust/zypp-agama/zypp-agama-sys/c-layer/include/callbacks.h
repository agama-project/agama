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

// keep in sync with below enum to ensure all entries here is also at the below
// one to allow 1:1 matching.
enum PROBLEM_RESPONSE { PROBLEM_RETRY, PROBLEM_ABORT, PROBLEM_IGNORE };
// NOTE: ensure that order are identical as PROBLEM_RESPONSE and NONE is at the
// end
enum OPTIONAL_PROBLEM_RESPONSE {
  OPROBLEM_RETRY,
  OPROBLEM_ABORT,
  OPROBLEM_IGNORE,
  OPROBLEM_NONE
};

enum DownloadProgressError {
  DPE_NO_ERROR,
  DPE_NOT_FOUND,     // the requested Url was not found
  DPE_IO,            // IO error
  DPE_ACCESS_DENIED, // user authent. failed while accessing restricted file
  DPE_ERROR          // other error
};
typedef void (*ZyppDownloadStartCallback)(const char *url,
                                          const char *localfile,
                                          void *user_data);
typedef bool (*ZyppDownloadProgressCallback)(int value, const char *url,
                                             double bps_avg, double bps_current,
                                             void *user_data);
typedef enum PROBLEM_RESPONSE (*ZyppDownloadProblemCallback)(
    const char *url, enum DownloadProgressError error, const char *description,
    void *user_data);
typedef void (*ZyppDownloadFinishCallback)(const char *url,
                                           enum DownloadProgressError error,
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

enum DownloadResolvableError {
  DRE_NO_ERROR,
  DRE_NOT_FOUND, // the requested Url was not found
  DRE_IO,        // IO error
  DRE_INVALID    // the downloaded file is invalid
};

enum DownloadResolvableFileError {
  DRFE_NO_ERROR,
  DRFE_NOT_FOUND,     // the requested Url was not found
  DRFE_IO,            // IO error
  DRFE_ACCESS_DENIED, // user authent. failed while accessing restricted file
  DRFE_ERROR          // other error
};

// keep in sync with
// https://github.com/openSUSE/libzypp/blob/master/zypp-logic/zypp/target/rpm/RpmDb.h#L376
// maybe there is a better way to export it to C?
enum GPGCheckPackageResult {
  CHK_OK = 0,         /*!< Signature is OK. */
  CHK_NOTFOUND = 1,   /*!< Signature is unknown type. */
  CHK_FAIL = 2,       /*!< Signature does not verify. */
  CHK_NOTTRUSTED = 3, /*!< Signature is OK, but key is not trusted. */
  CHK_NOKEY = 4,      /*!< Public key is unavailable. */
  CHK_ERROR = 5,      /*!< File does not exist or can't be opened. */
  CHK_NOSIG = 6,      /*!< File has no gpg signature (only digests). */
};

typedef void (*ZyppDownloadResolvableStartCallback)(void *user_data);
// TODO: do we need more resolvable details? for now just use name and url
typedef enum PROBLEM_RESPONSE (*ZyppDownloadResolvableProblemCallback)(
    const char *resolvable_name, enum DownloadResolvableError error,
    const char *description, void *user_data);
typedef enum OPTIONAL_PROBLEM_RESPONSE (
    *ZyppDownloadResolvableGpgCheckCallback)(
    const char *resolvable_name, const char *repo_url,
    enum GPGCheckPackageResult check_result, void *user_data);
typedef void (*ZyppDownloadResolvableFileFinishCallback)(
    const char *url, const char *local_path,
    enum DownloadResolvableFileError error, const char *error_details,
    void *user_data);

// progress for downloading resolvables (rpms). There are 3 callbacks now ( can
// be extended with progress and finish one):
// 1. start for start of preload
// 2. problem to react when something wrong happen and how to behave
// 3. gpg_check when there is issue with gpg check on resolvable
// 4. finish_file is when preload finish download of package including failed
// NOTE: user_data is separated for each call.
// NOTE: libzypp provides more data, but only those used by agama is used now.
struct DownloadResolvableCallbacks {
  ZyppDownloadResolvableStartCallback start_preload;
  void *start_preload_data;
  ZyppDownloadResolvableProblemCallback problem;
  void *problem_data;
  ZyppDownloadResolvableGpgCheckCallback gpg_check;
  void *gpg_check_data;
  ZyppDownloadResolvableFileFinishCallback file_finish;
  void *file_finish_data;
};

/**
 * @brief What to do with an unknown GPG key.
 * @see zypp::KeyRingReport::KeyTrust in https://github.com/openSUSE/libzypp/blob/master/zypp-logic/zypp/KeyRing.h
 */
enum GPGKeyTrust {
  /** Reject the key. */
  GPGKT_REJECT,
  /** Trust key temporary. Will be asked again when something is signed with it.
     Even within same session. */
  GPGKT_TEMPORARY,
  /** Import key and trust it. */
  GPGKT_IMPORT
};

/**
 * @brief Callback to decide whether to accept an unknown GPG key.
 * @param key_id The ID of the GPG key.
 * @param key_name The name of the GPG key.
 * @param key_fingerprint The fingerprint of the GPG key.
 * @param repository_alias The alias of the repository providing the key. Can be
 * an empty string if not available.
 * @param user_data User-defined data.
 * @return A GPGKeyTrust value indicating the action to take.
 *  @see zypp::KeyRingReport::askUserToAcceptKey in https://github.com/openSUSE/libzypp/blob/master/zypp-logic/zypp/KeyRing.h
 */
typedef enum GPGKeyTrust (*GPGAcceptKeyCallback)(const char *key_id,
                                                 const char *key_name,
                                                 const char *key_fingerprint,
                                                 const char *repository_alias,
                                                 void *user_data);
/**
 * @brief Callback for handling unsigned files.
 * @param file The path to the unsigned file.
 * @param repository_alias The alias of the repository. Can be an empty string
 * if not available.
 * @param user_data User-defined data.
 * @return true to continue, false to abort.
 */
typedef bool (*GPGUnsignedFile)(const char *file, const char *repository_alias,
                                void *user_data);
/**
 * @brief Callback for handling a file signed by an unknown key.
 * @param file The path to the file.
 * @param key_id The ID of the unknown GPG key.
 * @param repository_alias The alias of the repository. Can be an empty string
 * if not available.
 * @param user_data User-defined data.
 * @return true to continue, false to abort.
 */
typedef bool (*GPGUnknownKey)(const char *file, const char *key_id,
                              const char *repository_alias, void *user_data);
/**
 * @brief Callback for when GPG verification of a signed file fails.
 * @param file The path to the file.
 * @param key_id The ID of the GPG key.
 * @param key_name The name of the GPG key.
 * @param key_fingerprint The fingerprint of the GPG key.
 * @param repository_alias The alias of the repository. Can be an empty string
 * if not available.
 * @param user_data User-defined data.
 * @return true to continue, false to abort.
 */
typedef bool (*GPGVerificationFailed)(const char *file, const char *key_id,
                                      const char *key_name,
                                      const char *key_fingerprint,
                                      const char *repository_alias,
                                      void *user_data);
/**
 * @see zypp::DigestReport in https://github.com/openSUSE/libzypp/blob/master/zypp-logic/zypp/Digest.h
 */
typedef bool (*ChecksumMissing)(const char *file, void *user_data);
typedef bool (*ChecksumWrong)(const char *file, const char *expected,
                              const char *actual, void *user_data);
typedef bool (*ChecksumUnknown)(const char *file, const char *checksum,
                                void *user_data);

/**
 * @brief Callbacks for handling security related issues.
 *
 * This struct provides callbacks for handling various security-related events
 * that can occur during libzypp operations, such as GPG key management and
 * checksum verification.
 *
 * Each callback has a corresponding `_data` pointer that can be used to pass
 * user-defined data to the callback function.
 */
struct SecurityCallbacks {
  /** @brief Callback to decide whether to accept an unknown GPG key. */
  GPGAcceptKeyCallback accept_key;
  /** @brief User data for the `accept_key` callback. */
  void *accept_key_data;
  /** @brief Callback for handling unsigned files. */
  GPGUnsignedFile unsigned_file;
  /** @brief User data for the `unsigned_file` callback. */
  void *unsigned_file_data;
  /** @brief Callback for handling files signed with an unknown key. */
  GPGUnknownKey unknown_key;
  /** @brief User data for the `unknown_key` callback. */
  void *unknown_key_data;
  /** @brief Callback for handling GPG verification failures. */
  GPGVerificationFailed verification_failed;
  /** @brief User data for the `verification_failed` callback. */
  void *verification_failed_data;
  /** @brief Callback for when a checksum is missing. */
  ChecksumMissing checksum_missing;
  /** @brief User data for the `checksum_missing` callback. */
  void *checksum_missing_data;
  /** @brief Callback for when a checksum is wrong. */
  ChecksumWrong checksum_wrong;
  /** @brief User data for the `checksum_wrong` callback. */
  void *checksum_wrong_data;
  /** @brief Callback for when the checksum type is unknown. */
  ChecksumUnknown checksum_unknown;
  /** @brief User data for the `checksum_unknown` callback. */
  void *checksum_unknown_data;
};

#ifdef __cplusplus
}
#endif
#endif
