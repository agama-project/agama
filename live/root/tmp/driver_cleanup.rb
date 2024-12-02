#! /usr/bin/env ruby

# This script removes not needed drivers from the Live ISO. It deletes the drivers which are either
# not relevant for the installer (sound cards, TV cards, joysticks, NFC...) or the hardware is
# obsolete and very likely not used in modern systems (PCMCIA, Appletalk...).
#
# By default the script runs in safe mode and only lists the drivers to delete, use the "--delete"
# argument to really delete the drivers.
#
# The script uses the "module.list" file from the installation-images package
# (https://github.com/openSUSE/installation-images/blob/master/etc/module.list). The file should be
# updated manually from time to time. Hot fixes or Agama specific changes should be added into the
# module.list.extra file.
#
# The file lists the drivers or whole directories which should be present in the installation
# system. If the line starts with "-" then that driver or directory should be removed. It is usually
# connected with the previous line, it allows to include a whole directory with drivers but delete
# just a specific driver or subdirectory below it.
#
# The file is actually a list of Perl regexps, hopefully only the basic regexp features which work
# also in Ruby will be ever used...

require "find"
require "shellwords"

# class holding the kernel driver data
class Driver
  # the driver name, full file path, dependencies
  attr_reader :name, :path, :deps

  def initialize(name, path, deps)
    @name = name
    @path = path
    @deps = deps
  end

  # load the kernel driver data from the given path recursively
  def self.find(dir)
    drivers = []
    puts "Scanning kernel modules in #{dir}..."

    return drivers unless File.directory?(dir)
    
    Find.find(dir) do |path|
      if File.file?(path) && path.end_with?(".ko", ".ko.xz", ".ko.zst")
        drivers << Driver.from_file(path)
      end
    end

    return drivers
  end

  # create a driver object from a kernel driver file
  def self.from_file(file)
    deps = `/usr/sbin/modinfo -F depends #{file.shellescape}`.chomp.split(",")
    name = File.basename(file).sub(/\.ko(\.xz|\.zst|)\z/, "")
    Driver.new(name, file, deps)
  end
end

# really delete or just do a smoke test?
do_delete = ARGV[0] == "--delete"

# read the configuration files
config = File.read(File.join(__dir__, "module.list")).split("\n")
config += File.read(File.join(__dir__, "module.list.extra")).split("\n")

# remove comments and empty lines
config.reject!{|l| l.empty? || l.start_with?("#")}

# split the list into keep and delete parts (starting with "-")
delete, keep = config.partition{|c| c.start_with?("-")}

# remove the delete prefix "-"
delete.map!{|l| l.delete_prefix("-")}

# convert to regular expressions
keep.map!{|l| Regexp.new(l)}
delete.map!{|l| Regexp.new(l)}

# in the Live ISO there should be just one kernel installed
dir = Dir["/lib/modules/*"].first

to_keep = []
to_delete = []

puts "Scanning kernel modules in #{dir}..."
Find.find(dir) do |path|
  next unless File.file?(path) && path.end_with?(".ko", ".ko.xz", ".ko.zst")

  driver = Driver.from_file(path)

  kernel_path = path.delete_prefix(dir).delete_prefix("/")

  if delete.any?{|d| d.match?(kernel_path)}
    # deleted explicitly by config
    to_delete << driver
  elsif keep.any?{|k| k.match?(kernel_path)}
    # included explicitly by config
    to_keep << driver
  else
    # implicitly delete all unknown drivers not mentioned in the config
    to_delete << driver
  end
end

puts "Checking driver dependencies..."

# iteratively find the dependant drivers (dependencies of dependencies...), move the referenced
# drivers from the delete list to the keep list until no driver in the delete list is referenced
# from the keep list

loop do 
  referenced = to_delete.select do |dd|
    to_keep.any?{|ad| ad.deps.include?(dd.name)}
  end

  # no dependencies, the end of the dependency chain reached
  break if referenced.empty?

  referenced.each do |d|
    puts "Keep dependant driver #{d.path}"
  end

  # move the referenced drivers from the delete list to the keep list
  to_keep += referenced
  to_delete.reject!{|a| referenced.any?{|d| d.path == a.path}}
end

# total size counter
driver_size = 0

# process the list of the drivers to delete
to_delete.each do |d|
  driver_size += File.size(d.path)

  if (do_delete)
    puts "Deleting #{d.path}"
    File.delete(d.path)
  else
    puts "Driver to delete #{d.path}"
  end
end

puts "Found #{to_delete.size} drivers to delete (#{driver_size/1024/1024} MiB)"

# at the end update the kernel driver metadata (modules.dep and others)
if (do_delete)
  puts "Updating driver metadata..."
  system("/sbin/depmod -a -F #{dir.shellescape}/System.map")
end
