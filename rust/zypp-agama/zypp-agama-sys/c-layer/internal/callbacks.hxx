#ifndef C_CALLBACKS_HXX_
#define C_CALLBACKS_HXX_

#include "callbacks.h"
// C++ specific code call that cannot be used from C. Used to pass progress
// class between o files.
#include <zypp-core/ui/progressdata.h>
zypp::ProgressData::ReceiverFnc
create_progress_callback(ZyppProgressCallback progress, void *user_data);

// pair of set and unset calls. Struct for callbacks has to live as least as
// long as unset is call. idea is to wrap it around call that do some download
void set_zypp_download_callbacks(struct DownloadProgressCallbacks *callbacks);
void unset_zypp_download_callbacks();

// pair of set/unset callbacks used during commit when download packages.
// Uses mixture of ResolvableDownloadReport and also CommitPreloadReport
// to capture related parts of commit download reports.
void set_zypp_resolvable_download_callbacks(
    struct DownloadResolvableCallbacks *callbacks);
void unset_zypp_resolvable_download_callbacks();

// pair of set/unset callbacks used for security reports.
// Uses mixture of KeyRingReport and DigestReport
void set_zypp_security_callbacks(struct SecurityCallbacks *callbacks);
void unset_zypp_security_callbacks();

// pair of set/unset callbacks used for installation reports.
void set_zypp_install_callbacks(struct InstallCallbacks *callbacks);
void unset_zypp_install_callbacks();

#endif
