# Makefile for building the Live ISO sources for OBS, see README.md for more
# details.

# directory with the sources
SRCDIR = ./src

# the target directory
DESTDIR = ./dist

# the default build flavor, see the src/_multibuild file,
# to build a different flavor run "make build FLAVOR=<flavor>"
FLAVOR = openSUSE

# files to copy from src/
COPY_FILES = $(patsubst $(SRCDIR)/%,$(DESTDIR)/%,$(wildcard $(SRCDIR)/*))

all: $(DESTDIR) $(COPY_FILES) $(DESTDIR)/config-cdroot.tar.xz $(DESTDIR)/root.tar.xz $(DESTDIR)/root-ALP-PXE.tar.xz

# clean the destination directory (but keep the .osc directory if it is present)
clean:
	rm -rf $(DESTDIR)/*

$(DESTDIR):
	mkdir -p $@

# copy the files from src/ to dist/
$(DESTDIR)/%: $(SRCDIR)/%
	cp -f $< $@

# make a tarball from a directory
# the tarball is reproducible, i.e. the same sources should result in the very same tarball (bitwise)
# for the file time stamps use the date of the last commit in the respective directory
$(DESTDIR)/%.tar.xz: %
	(cd $< && find . -xtype f -not -name README.md | LC_ALL=C sort | tar -c -v -f - --format=gnu --owner=0 --group=0 --files-from - --mtime="$(shell git log -n 1 --pretty=format:%ci $<)") | xz -c -9 -e > $@

# build the ISO locally
build: $(DESTDIR)
	if [ ! -e  $(DESTDIR)/.osc ]; then make clean; osc co -o $(DESTDIR) systemsmanagement:Agama:Staging agama-live; fi
	$(MAKE) all
	(cd $(DESTDIR) && osc build -M $(FLAVOR) images)
