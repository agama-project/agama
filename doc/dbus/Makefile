# quick and dirty
all:
	for f in  org.opensuse.Agama*.dbus.xml; do \
	  docbook=$${f%.dbus.xml}.ref.xml; \
	  xsltproc --novalid --output $$docbook spec-to-docbook.xsl $$f; \
	  xmlto --skip-validation html-nochunks $$docbook; \
	done
