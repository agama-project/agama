# quick and dirty
all:
	for f in  org.opensuse.Agama*.doc.xml; do \
	  docbook=$${f%.doc.xml}.ref.xml; \
	  xsltproc --novalid --output $$docbook spec-to-docbook.xsl $$f; \
	  xmlto --skip-validation html-nochunks $$docbook; \
	done
