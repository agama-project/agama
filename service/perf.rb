require "benchmark"

$LOAD_PATH << File.expand_path("lib", __dir__)

require "dinstaller/dbus/clients/dinstaller"

PACKAGES = ["autologin-support", "kdm", "gdm", "sddm", "lightdm"].freeze

CLIENT = DInstaller::DBus::Clients::DInstaller 
#warm up call
CLIENT.provisions_selected?(PACKAGES)

RUNS = 100

Benchmark.bm(15) do |x|
  x.report("ask multi:") { RUNS.times { PACKAGES.each { |p| CLIENT.provision_selected?(p) } } }
  x.report("single call:") { RUNS.times { CLIENT.provisions_selected?(PACKAGES) } }
end
