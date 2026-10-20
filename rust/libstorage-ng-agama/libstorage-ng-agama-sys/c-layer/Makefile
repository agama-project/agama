AR=ar
CXX=g++
# Set LIBSTORAGE_NG_INCLUDE_DIR to build against a non-default libstorage-ng.
CXXFLAGS=-Wall -I./include -std=c++17 -fPIE \
  $(shell pkg-config --cflags libxml-2.0) \
  $(if $(LIBSTORAGE_NG_INCLUDE_DIR),-I$(LIBSTORAGE_NG_INCLUDE_DIR))
DEPS = include/lib.h
OBJ = lib.o

all: libagama-storage.a

clean:
	rm -vf *.o *.a

check:
	git ls-files | grep -E '\.(c|h|cxx|hxx)$$' | \
	  xargs --verbose clang-format --style=llvm -Werror --dry-run

libagama-storage.a: $(OBJ)
	$(AR) -crs $@ $^

%.o: %.cxx $(DEPS)
	$(CXX) -c -o $@ $< $(CXXFLAGS)

format:
	git ls-files | grep -E '\.(c|h|cxx|hxx)$$' | \
	  xargs --verbose clang-format --style=llvm -i
