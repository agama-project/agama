#ifndef C_HELPERS_HXX_
#define C_HELPERS_HXX_

#include <cstdarg>
#include <stdlib.h>

// helper to get allocated formated string. Sadly C does not provide any
// portable way to do it. if we are ok with GNU or glib then it provides it
static char *format_alloc(const char *const format...) {
  // `vsnprintf()` changes `va_list`'s state, so using it after that is UB.
  // We need the args twice, so it is safer to just get two copies.
  va_list args1;
  va_list args2;
  va_start(args1, format);
  va_start(args2, format);

  // vsnprintf with len 0 just return needed size and add trailing zero.
  size_t needed = 1 + vsnprintf(NULL, 0, format, args1);

  char *buffer = (char *)malloc(needed * sizeof(char));

  vsnprintf(buffer, needed, format, args2);

  va_end(args1);
  va_end(args2);

  return buffer;
}

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

/// Macro to help report failure with error string which is passed to format
#define STATUS_ERROR(status, ...)                                              \
  ({                                                                           \
    status->state = status->STATE_FAILED;                                      \
    status->error = format_alloc(__VA_ARGS__);                                 \
  })

#endif