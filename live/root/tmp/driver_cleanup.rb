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

# Remove lines for other architectures than the current machine architecture. The arch specific
# lines start with the <$arch> line and end with the </$arch> line.
def arch_filter(lines)
  # the current state for a finite-state machine with two states (inside or outside an arch tag)
  skipping = false
  # the current machine architecture
  arch = `arch`.strip
  # the architecture from the tag line
  arch_tag = nil

  lines.reject! do |line|
    # opening arch tag
    if line.match(/^\s*<\s*(\w+)\s*>\s*$/)
      arch_tag = Regexp.last_match[1]
      skipping = arch_tag != arch
      # always remove the arch tag
      next true
    end

    # closing arch tag, for simplicity let's assume it matches the previous opening tag, the tags
    # cannot be nested and the input file is under our control and so we can be sure it is valid
    if line.match(/^\s*<\/\s*\w+\s*>\s*$/)
      skipping = false
      # always remove the arch tag
      next true
    end

    if skipping
      puts "Ignoring #{arch_tag} specific line: #{line}"
    end

    skipping
  end
end

# really delete or just do a smoke test?
do_delete = ARGV[0] == "--delete"
debug = ENV["DEBUG"] == "1"

# read the configuration files
# this file is a copy from https://github.com/openSUSE/installation-images/blob/master/etc/module.list
config = File.read(File.join(__dir__, "module.list")).split("\n")
# here are Agama specific overrides
config += File.read(File.join(__dir__, "module.list.extra")).split("\n")

# remove comments and empty lines
config.reject!{|l| l.empty? || l.start_with?("#")}

# process the architecture specific lines
arch_filter(config)

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

delete_drivers = to_delete.map(&:path)
puts "Found #{delete_drivers.size} drivers to delete"
puts delete_drivers if debug
File.delete(*delete_drivers) if do_delete

# Note: The module dependencies are updated by the config.sh script
# after decompressing the drivers.
