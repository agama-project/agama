#ifndef C_HELPERS_HXX_
#define C_HELPERS_HXX_

#include <stdlib.h>
/// Macro in case of programmer error. We do not use exceptions do to usage of
/// noexpect in all places to avoid flowing exceptions to our pure C API. It
/// basically print message to stderr and abort
#define PANIC(...)                                                             \
  fprintf(stderr, __VA_ARGS__);                                                \
  abort()

#endif