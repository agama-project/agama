#ifndef C_HELPERS_HXX_
#define C_HELPERS_HXX_

#include <stdlib.h>
/// Macro in case of programmer error. We do not use exceptions do to usage of
/// noexpect in all places to avoid flowing exceptions to our pure C API. It
/// basically print message to stderr and abort
#define PANIC(...)                                                             \
  fprintf(stderr, __VA_ARGS__);                                                \
  abort()

/// Macro to define that status if OK
#define STATUS_OK(status)                                                      \
  ({                                                                           \
    status->state = status->STATE_SUCCEED;                                     \
    status->error = NULL;                                                      \
  })

/// Macro to help report failure with zypp exception
#define STATUS_EXCEPT(status, excpt)                                           \
  ({                                                                           \
    status->state = status->STATE_FAILED;                                      \
    status->error = strdup(excpt.asUserString().c_str());                      \
  })

/// Macro to help report failure with static string
#define STATUS_ERROR(status, err_str)                                          \
  ({                                                                           \
    status->state = status->STATE_FAILED;                                      \
    status->error = strdup(err_str);                                           \
  })

/// Macro to help report failure with own allocated string
/// which will be later free with free_status method
#define STATUS_ERR_MSG(status, err_str)                                        \
  ({                                                                           \
    status->state = status->STATE_FAILED;                                      \
    status->error = strdup(err_str);                                           \
  })

#endif