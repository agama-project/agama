# Makefile for AutoYaST schema

RNCDIR = rnc
RNGDIR = rng
RNCS = $(wildcard $(RNCDIR)/*.rnc)
RNGS = $(RNGDIR)/profile.rng $(RNGDIR)/rules.rng $(RNGDIR)/classes-decl.rng

# installation paths
INSTALL = install
DESTDIR =
PREFIX = /usr
datadir = $(PREFIX)/share
schemadir = $(datadir)/YaST2/schema

# Decrease some JRE space to fit in limited memory on ci.opensuse.org
# Prevents "Could not allocate metaspace: 1073741824 bytes"
# https://rce-docs.hmdc.harvard.edu/faq/why-do-i-get-java-error-could-not-reserve-enough-space-object-heap
export _JAVA_OPTIONS = -XX:CompressedClassSpaceSize=200M

.PHONY: all clean check install

all: $(RNGS)

$(RNGDIR):
	mkdir -p $@

# the RNC files include each other (e.g. common.rnc), so rebuild everything
# when any of them changes
$(RNGDIR)/%.rng: $(RNCDIR)/%.rnc $(RNCS) | $(RNGDIR)
	trang -I rnc -O rng $< $@

clean:
	rm -rf $(RNGDIR)

# Test with a minimal valid profile that the schema is correct
check: $(RNGDIR)/profile.rng
	if command -v jing >/dev/null 2>&1; then \
		echo '<profile xmlns="http://www.suse.com/1.0/yast2ns"/>' | jing $(RNGDIR)/profile.rng /dev/stdin; \
	else \
		echo "jing not found, skipping the jing validation"; \
	fi
	echo '<profile xmlns="http://www.suse.com/1.0/yast2ns"/>' | xmllint --noout --relaxng $(RNGDIR)/profile.rng /dev/stdin

install: all
	$(INSTALL) -d $(DESTDIR)$(schemadir)/autoyast/rng
	$(INSTALL) -m 644 $(RNGDIR)/*.rng $(DESTDIR)$(schemadir)/autoyast/rng
