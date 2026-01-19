DOMAIN = agama
POTFILE = $(DOMAIN).pot
POFILES = $(wildcard *.po)
MOFILES = $(POFILES:.po=.mo)
LINGUAS = $(POFILES:.po=)
datadir ?= /usr/share

.PHONY: all
all: $(MOFILES)

%.mo: %.po
	msgfmt -o $@ $<

.PHONY: install
install: all
	for lang in $(LINGUAS); do \
		install -d $(DESTDIR)$(datadir)/locale/$$lang/LC_MESSAGES; \
		install -m 644 $$lang.mo $(DESTDIR)$(datadir)/locale/$$lang/LC_MESSAGES/$(DOMAIN).mo; \
	done

.PHONY: clean
clean:
	rm -f $(MOFILES)
