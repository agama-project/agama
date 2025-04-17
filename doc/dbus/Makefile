distdir=../dist/dbus
tmpdir=./tmp

# build HTML for GitHub pages
all:
	./build-docs "${distdir}" "${tmpdir}"

clean:
	rm -rf "${distdir}" "${tmpdir}"

# check that the implementation and documentation haven't diverged
diff: check
check:
	./compare-impl-and-docs "${tmpdir}"

.PHONY: all diff check