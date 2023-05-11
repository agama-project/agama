distdir=../dist/dbus
tmpdir=./tmp

# build HTML for GitHub pages
all: ${distdir} ${tmpdir}
	for f in org.opensuse.Agama*.doc.xml; do \
	  echo $$f; \
	  gdbus-codegen \
	    --interface-prefix=org.opensuse.Agama. \
	    --output-directory=${tmpdir} \
	    --generate-docbook=ref \
	    $$f; \
	  docbook=${tmpdir}/ref-$${f%.doc.xml}.xml; \
	  xmlto -o ${distdir} --skip-validation html-nochunks $$docbook; \
	done
	cp index.html ${distdir}

# 'foo 2> >(grep ... >&2)' greps stderr and keeps it as stderr
NO_COMMENTS=xmlstarlet canonic --without-comments 2> >(grep -v 'Attempt to load network entity' >&2)
# bash because of the >() process substitution
SHELL=/bin/bash

# check that the implementation and documentation haven't diverged
# TODO: factor out a script to decouple Make syntax from the rest
diff: ${tmpdir}
	ALL_GOOD=true; \
	for doc_xml in org.opensuse.Agama*.doc.xml; do \
	  IFACE=$${doc_xml%.doc.xml}; \
	  bus_xml=bus/$$IFACE.bus.xml; \
	  doc_iface=${tmpdir}/$$IFACE.doc.iface.xml; \
	  bus_iface=${tmpdir}/$$IFACE.bus.iface.xml; \
	  \
	  echo "Diffing $$IFACE"; \
	  \
	  $(NO_COMMENTS) \
	    $${doc_xml} \
	    > $${doc_iface}; \
	  xmlstarlet ed \
	    -d "//interface[@name!='$$IFACE']" \
	    $${bus_xml} \
	    | $(NO_COMMENTS) - \
	    > $${bus_iface}; \
	  diff --ignore-blank-lines --ignore-trailing-space -u $${doc_iface} $${bus_iface} || ALL_GOOD=false; \
	done; \
	$$ALL_GOOD
	@echo "NO DIFF, YAY"

${distdir}:
	mkdir -p $@
${tmpdir}:
	mkdir -p $@
