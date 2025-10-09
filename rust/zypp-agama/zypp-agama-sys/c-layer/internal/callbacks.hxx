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

#endif
