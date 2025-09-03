#! /usr/bin/env ruby

# This script removes unused firmware files (not referenced by any kernel
# driver) from the system. By default the script runs in safe mode and only
# lists the unused firmware file, use the "--delete" argument to delete the
# found files.

require "find"
require "shellwords"

# really delete or just do a smoke test?
do_delete = ARGV[0] == "--delete"

# firmware location
fw_dir = "/lib/firmware/"

# in the Live ISO there should be just one kernel installed
dir = Dir["/lib/modules/*"].first
puts "Scanning kernel modules in #{dir}..."

# find all symlinks until the final file is found, if a file is passed then the
# file only is returned
# @return [Array<String>] list of files/symlinks
def symlinks(path, fw_dir)
  ret = [path]

  while File.symlink?(path)
    # do not use File.realpath as it skips all intermediate symlinks and returns the final target
    target = File.readlink(path)
    abs_target = File.absolute_path(target, File.dirname(path))

    # a cycle or a broken link is detected, or the link points outside of the firmware directory
    break if ret.include?(abs_target) || !File.exist?(abs_target) || !abs_target.start_with?(fw_dir)

    puts "Adding symlink #{path.delete_prefix(fw_dir)} -> #{target} (#{abs_target})"
    ret << abs_target

    # prepare for the next iteration round
    path = abs_target
  end

  ret
end

# list of referenced firmware names from the kernel modules, includes symlinks and expanded globs,
# the paths are relative to the /lib/firmware root
fw = []

# traverse the kernel drivers tree and extract the needed firmware files
Find.find(dir) do |path|
  if File.file?(path) && path.end_with?(".ko", ".ko.xz", ".ko.zst")
    driver_fw = `/usr/sbin/modinfo -F firmware #{path.shellescape}`.split("\n")

    driver_fw.each do |fw_name|
      f = fw_name.dup
      # the firmware can be compressed, match also the compressed variants, if
      # a wildcard is at the end then it already matches so it does not need
      # to be added (compressed files would be then included twice)
      f += "{,.xz,.zst}" if !f.end_with?("*")

      matching = Dir.glob(File.join(fw_dir, f))

      if fw_name.include?("*")
        puts "Pattern #{fw_name.inspect} expanded to: #{matching.join(", ")}"
      end

      # find symlink targets if the file is a symlink
      fw_files = matching.inject([]){|acc, file| acc += symlinks(file, fw_dir)}

      fw += fw_files.map{|m| m.delete_prefix(fw_dir)}
    end
  end
end

puts "Removing unused firmware..."
# counter for total unused firmware size
unused_size = 0

# traverse the firmware tree and delete the files which are not referenced by any kernel module
Find.find(fw_dir) do |fw_path|
  next unless File.file?(fw_path)

  fw_name = fw_path.delete_prefix(fw_dir)

  if !fw.include?(fw_name)
    unused_size += File.size(fw_path)
    if (do_delete)
      File.delete(fw_path)
    else
      puts "Found unused firmware #{fw_path}"
    end
  end
end

# do some cleanup at the end
if (do_delete)
  puts "Removing dangling symlinks..."
  system("find #{fw_dir.shellescape} -xtype l -delete")
  puts "Removing empty directories..."
  system("find #{fw_dir.shellescape} -type d -empty -delete")
end

puts "Unused firmware size: #{unused_size} (#{unused_size >> 20} MiB)"
