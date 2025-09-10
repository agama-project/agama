# Makefile for building the Live ISO sources for OBS, see README.md for more
# details.

# directory with the sources
SRCDIR = ./src

# the target directory
DESTDIR = ./dist

# the default build flavor, see the src/_multibuild file,
# to build a different flavor run "make build FLAVOR=<flavor>"
FLAVOR = openSUSE

# the default OBS project,
# to use a different project run "make build OBS_PROJECT=<project>"
OBS_PROJECT = "systemsmanagement:Agama:Devel"
OBS_PACKAGE = "agama-installer"
# to use internal OBS add "OBS_API=https://api.suse.de"
OBS_API = "https://api.opensuse.org"
# default OBS build target
OBS_TARGET = "images"
ARCH = $(shell uname -m)

# list of target files, ignore the SLES specific files (matching *_sles pattern)
COPY_FILES = $(patsubst $(SRCDIR)/%,$(DESTDIR)/%, $(filter-out ./src/%_sles,$(wildcard $(SRCDIR)/*)))
# only the SLES specific target files (matching *_sles pattern)
COPY_FILES_SLES = $(patsubst $(SRCDIR)/%,$(DESTDIR)/%, $(filter ./src/%_sles,$(wildcard $(SRCDIR)/*)))

# the default target, build the sources for openSUSE image
all: $(DESTDIR) $(COPY_FILES) $(DESTDIR)/config-cdroot.tar.xz $(DESTDIR)/live-root.tar.xz

# build the sources for SLES image, builds the openSUSE sources and then modifies them for SLES
# (use the SLES specific _multibuild file, add "SLES" into the changes and the Kiwi file name)
sles: all $(COPY_FILES_SLES)
	rename _sles "" $(DESTDIR)/*_sles
	rename . -- -SLES. $(DESTDIR)/*-installer.changes $(DESTDIR)/*-installer.kiwi

# clean the destination directory (but keep the .osc directory if it is present)
clean:
	rm -rf $(DESTDIR)/*

# remove the destination directory completely (useful when changing OBS target as it also cleans
# the .osc checkout directory)
distclean:
	rm -rf $(DESTDIR)

$(DESTDIR):
	mkdir -p $@

# copy the files from src/ to dist/
$(DESTDIR)/%: $(SRCDIR)/%
	@if [ -e "$@" ]; then MSG="updated"; else MSG="created"; fi; \
	cp -f $< $@ ;\
	echo "$@ $${MSG}"

# make a tarball from a directory
# the tarball is reproducible, i.e. the same sources should result in the very
# same tarball (bitwise) for the file time stamps use the date of the last
# commit in the respective directory, use the UTC date to avoid possible time
# zone and DST differences
#
# we need the second expansion here to depend on all files in the source
# directory, the first expansion expands `%` and reduces the escaped $$
# to a single $, the second expansion runs $(shell find ...)
# https://www.gnu.org/software/make/manual/html_node/Secondary-Expansion.html
.SECONDEXPANSION:
$(DESTDIR)/%.tar.xz: % $$(shell find % -type f,l)
	@if [ -e "$@" ]; then MSG="updated"; else MSG="created"; fi; \
	MTIME=$$(date --date="$$(git log -n 1 --pretty=format:%ci $<)" --utc +"%Y-%m-%d %H:%M:%S"); \
	(cd $< && find . -type f,l -not -name README.md | LC_ALL=C sort | tar -c -f - --format=gnu --owner=0 --group=0 --files-from - --mtime="$$MTIME") | xz -c -9 -e > $@; \
	echo "$@ $${MSG}"

# build the ISO locally
# allow passing optional parameters to osc like "-p <dir>" or "-k <dir>" via OSC_OPTS
build: $(DESTDIR)
	if [ ! -e  $(DESTDIR)/.osc ]; then make clean; osc -A $(OBS_API) co -o $(DESTDIR) $(OBS_PROJECT) $(OBS_PACKAGE); fi
	$(MAKE) all
	(cd $(DESTDIR) && osc -A $(OBS_API) build -M $(FLAVOR) $(OSC_OPTS) $(OBS_TARGET) $(ARCH) $(KIWI_FILE))

check:
	for i in ./test/*_test.*; do $${i} || exit 1; done

# Shellcheck reports lots of warnings, run it in the error-only mode first. If that succeeds run it
# in full mode with warnings but ignore the failures (some are false positives).
# TODO: Fix/disable the warnings and run it in more strict mode.
shellcheck:
	@find config-cdroot live-root src -type f -exec grep -l -E "^#! *(/usr/|)/bin/(ba|)sh" \{\} \; \
	  | xargs -I% bash -c "echo 'Checking errors in %...' && shellcheck --severity=error %"
	@find config-cdroot live-root src -type f -exec grep -l -E "^#! *(/usr/|)/bin/(ba|)sh" \{\} \; \
	  | xargs -I% bash -c "echo 'Checking warnings in %...' && shellcheck %" || true

.PHONY: build all sles clean shellcheck
