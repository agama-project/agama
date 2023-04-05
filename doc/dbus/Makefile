distdir=../dist/dbus
tmpdir=./tmp

# build HTML for GitHub pages
all: ${distdir} ${tmpdir}
	for f in org.opensuse.Agama*.doc.xml; do \
	  docbook=${tmpdir}/$${f%.doc.xml}.ref.xml; \
	  xsltproc --novalid --output $$docbook spec-to-docbook.xsl $$f; \
	  xmlto -o ${distdir} --skip-validation html-nochunks $$docbook; \
	done
	cp index.html ${distdir}

# check that the implementation and documentation haven't diverged
# TODO: factor out a script to decouple Make syntax from the rest
diff: ${tmpdir}
	for doc_xml in org.opensuse.Agama*.doc.xml; do \
	  DOCNS="http://www.freedesktop.org/dbus/1.0/doc.dtd"; \
	  IFACE=$${doc_xml%.doc.xml}; \
	  bus_xml=bus/$$IFACE.bus.xml; \
	  doc_iface=${tmpdir}/$$IFACE.doc.iface.xml; \
	  bus_iface=${tmpdir}/$$IFACE.bus.iface.xml; \
	  \
	  xmlstarlet ed \
	    -N doc=$$DOCNS \
	    -d "//doc:doc" \
	    $${doc_xml} \
	    | sed -e "s|<node xmlns:doc=\"$$DOCNS\" name=|<node name=|" \
	    > $${doc_iface}; \
	  xmlstarlet ed \
	    -d "//interface[@name!='$$IFACE']" \
	    $${bus_xml} > $${bus_iface}; \
	  diff --ignore-blank-lines --ignore-trailing-space -u $${doc_iface} $${bus_iface}; \
	done
	echo "NO DIFF, YAY"

${distdir}:
	mkdir -p $@
${tmpdir}:
	mkdir -p $@
