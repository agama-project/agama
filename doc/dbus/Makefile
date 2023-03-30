# quick and dirty
all:
	for f in  org.opensuse.Agama.*1.xml; do \
	  docbook=$${f%.xml}.ref.xml; \
	  xsltproc --novalid --output $$docbook spec-to-docbook.xsl $$f; \
	  xmlto --skip-validation html-nochunks $$docbook; \
	done
