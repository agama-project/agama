# make check:
# - well-formedness of YAML files

.PHONY: check
check:
	ruby -ryaml -e 'Dir.glob("*.{yml,yaml}").sort.each { |fn| puts fn; YAML.safe_load(File.read(fn)) }; puts "OK"'
