# quick and dirty
all:
	for f in  org.opensuse.Agama.*1.xml; do \
	  docbook=$${f%.xml}.ref.xml; \
	  ./spec-to-docbook.sh spec-to-docbook.xsl $$f $$docbook; \
	  xmlto --skip-validation html-nochunks $$docbook; \
	done
