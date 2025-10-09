AR=ar
CXX=g++
CXXFLAGS=-Wall -I./include -I./internal -Izypp -Wall -std=c++14 -lzypp -lsystemd -fPIE
DEPS = include/lib.h include/callbacks.h internal/callbacks.hxx
OBJ = lib.o callbacks.o

all: libagama-zypp.a

clean:
	rm -vf *.o *.a

check:
	git ls-files | grep -E '\.(c|h|cxx|hxx)$$' | \
	  xargs --verbose clang-format --style=llvm --dry-run

libagama-zypp.a: $(OBJ)
	$(AR) -crs $@ $^

%.o: %.cxx $(DEPS)
	$(CXX) -c -o $@ $< $(CXXFLAGS)

format:
	git ls-files | grep -E '\.(c|h|cxx|hxx)$$' | \
	  xargs --verbose clang-format --style=llvm -i
