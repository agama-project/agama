#! /usr/bin/env ruby

# This script removes not needed multimedia drivers (sound cards, TV cards,...).
#
# By default the script runs in safe mode and only lists the drivers to delete,
# use the "--delete" argument to really delete the drivers.

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
        name = File.basename(path).sub(/\.ko(\.xz|\.zst|)\z/, "")
        deps = `/usr/sbin/modinfo -F depends #{path.shellescape}`.chomp.split(",")
        drivers << Driver.new(name, path, deps)
      end
    end

    return drivers
  end
end

# delete the kernel drivers in these subdirectories, but keep the drivers used by
# dependencies from other drivers
delete = [
  "kernel/sound", 
  "kernel/drivers/media",
  "kernel/drivers/staging/media"
]

# in the Live ISO there should be just one kernel installed
dir = Dir["/lib/modules/*"].first

# drivers to delete
delete_drivers = []

# scan the drivers in the delete subdirectories
delete.each do |d|
  delete_drivers += Driver.find(File.join(dir, d))
end

all_drivers = Driver.find(dir)

# remove the possibly deleted drivers
all_drivers.reject!{|a| delete_drivers.any?{|d| d.name == a.name}}

puts "Skipping dependent drivers:"

# iteratively find the dependant drivers (dependencies of dependencies...)
loop do 
  referenced = delete_drivers.select do |dd|
    all_drivers.any?{|ad| ad.deps.include?(dd.name)}
  end

  # no more new dependencies, end of the dependency chain reached
  break if referenced.empty?

  puts referenced.map(&:path).sort.join("\n")

  # move the referenced drivers from the "delete" list to the "keep" list
  all_drivers += referenced
  delete_drivers.reject!{|a| referenced.any?{|d| d.name == a.name}}
end

puts "Drivers to delete:"
delete = ARGV[0] == "--delete"

delete_drivers.each do |d|
  if (delete)
    puts "Deleting #{d.path}"
    File.delete(d.path)
  else
    puts d.path
  end
end
