# Copyright (c) [2018] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "singleton"
require "fileutils"
require "yast"
require "y2storage/devicegraph"
require "y2storage/actions_presenter"
require "y2storage/storage_manager"

Yast.import "Mode"

module Y2Storage
  # Helper class to manage XML and YAML devicegraph dumps.
  # Most of this is handling log rotation.
  # This is a singleton class; use DumpManager.instance for all methods.
  class DumpManager
    include Singleton
    include Yast::Logger

    # The number of old dump directories to keep.
    # This is in addition to the current one.
    KEEP_OLD_DUMP_DIRS = 3

    def initialize
      @initialized = false
    end

    # Kill (recursively remove) all dump directories.
    def kill_all_dump_dirs
      Dir.glob(base_dir + "/storage*").each { |dir| FileUtils.remove_dir(dir) }
    end

    # Reset the dump directories: Rotate any old ones, create a new one and
    # start numbering devicegraph dump files from zero.
    def reset
      rotate_dump_dirs
      ensure_dump_dir
      @prefix = "00"
      @initialized = true
    end

    # Dump a devicegraph or the actions from an ActionsPresenter to file in
    # human-readable format.
    #
    # If 'file_base_name' is specified, this is used. If it is nil, for
    # devicegraphs an appropriate name based on its role (probed, staging) is
    # generated, for actions, it is "actions".
    #
    # In any case, use a numbered prefix to make the sequence of files clear,
    # and use the appropriate suffix (filename extension) depending on type.
    #
    # This will typically result in something like this:
    #
    #   01-probed.xml
    #   01-probed.yml
    #   02-staging.xml
    #   02-staging.yml
    #   03-staging.xml
    #   03-staging.yml
    #   04-actions.txt
    #   05-committed.xml
    #   05-committed.yml
    #
    # The directory to use is chosen according to the YaST mode (installation
    # vs. installed system), and the directories are cleared (installation) or
    # rotated (installed system) for each program invocation.
    #
    # @param dump_obj [Y2Storage::Devicegraph, Y2Storage::ActionsPresenter]
    # @param file_base_name [String, nil] File base name to use.
    #
    # @return [String] file base name with numeric prefix actually used
    #   ("01-probed", "02-staging", ...)
    #
    # @raise [ArgumentError] for unknown types to dump
    #
    def dump(dump_obj, file_base_name = nil)
      return nil if dump_obj.nil?

      if dump_obj.is_a?(Y2Storage::Devicegraph)
        dump_devicegraph(dump_obj, file_base_name)
      elsif dump_obj.is_a?(Y2Storage::ActionsPresenter)
        dump_actions(dump_obj, file_base_name)
      elsif mocked_object?(dump_obj)
        log.warn("Not dumping #{dump_obj.class}")
      else
        raise ArgumentError, "Unsupported type to dump: #{dump_obj.class}"
      end
    end

    # Class method for dumping (for convenience).
    # @see Y2Storage::DumpManager#dump
    def self.dump(dump_obj, file_base_name = nil)
      instance.dump(dump_obj, file_base_name)
    end

    # Dump a devicegraph to both XML and YAML.
    #
    # Use the specified name as the file base name or, if not specified,
    # generate a name based on the role of the devicegraph (probed,
    # staging). In any case, use a numbered prefix to make the sequence of
    # files clear, and use the appropriate suffix (filename extension)
    # depending on type.
    #
    # @param devicegraph [Y2Storage::Devicegraph] devicegraph to dump
    # @param file_base_name [String, nil] File base name to use.
    #
    # @return [String] file base name with numeric prefix actually used
    #   ("01-probed", "02-staging", ...)
    #
    def dump_devicegraph(devicegraph, file_base_name = nil)
      file_base_name ||= devicegraph_dump_name(devicegraph)
      dump_internal(devicegraph, file_base_name) do |file_base_path|
        devicegraph.save(file_base_path + ".xml")
        YamlWriter.write(devicegraph, file_base_path + ".yml", record_passwords: false)
      end
    end

    # Dump actions from an ActionsPresenter. This works very much like dumping
    # the devicegraph.
    #
    # @param actions_presenter [ActionsPresenter]
    # @param file_base_name [String, nil] File base name to use.
    #
    # @return [String] file base name with numeric prefix actually used
    #
    def dump_actions(actions_presenter, file_base_name = nil)
      file_base_name ||= "actions"
      dump_internal(actions_presenter, file_base_name) do |file_path|
        actions_presenter.save(file_path + ".txt")
      end
    end

    # Get a suitable name for dumping for well-known devicegraphs.
    #
    # @return [String]
    def devicegraph_dump_name(devicegraph)
      return nil if devicegraph.nil?
      return "probed"  if devicegraph.equal?(StorageManager.instance.probed)
      return "staging" if devicegraph.equal?(StorageManager.instance.staging)

      "devicegraph"
    end

    # Return true if this is some installation mode: installation, update,
    # AutoYaST.
    #
    # @return [Boolean]
    def installation?
      Yast::Mode.installation || Yast::Mode.update
    end

    # Return a suitable name for the devicegraph dump directory
    # depending on the YaST mode (installation / installed system).
    #
    # @return [String] directory name with full path
    def dump_dir
      dir = installation? ? "storage-inst" : "storage"
      base_dir + "/" + dir
    end

    # Return the base directory to put the dump directories in.
    #
    # @return [String] directory name with full path
    def base_dir
      if running_as_root?
        Yast::Directory.logdir
      else
        Dir.home + "/.y2storage"
      end
    end

    # Rotate the dump directories, depending on current YaST mode:
    #
    # During installation (or update or AutoYaST), clear and remove any old
    # /var/log/YaST2/storage-inst directory.
    #
    # In the installed system, keep a number of old dump directories, remove
    # any older ones in /var/log/YaST2, and rename the ones to keep:
    #
    #   rm -rf storage-03
    #   mv storage-02 storage-03
    #   mv storage-01 storage-02
    #   mv storage    storage-01
    #
    # This will NOT create any new dump directory.
    def rotate_dump_dirs
      # Intentionally not calling ensure_initialized here:
      # that would rotate the dump dirs twice.
      return unless File.exist?(base_dir)

      if installation?
        kill_old_dump_dirs([File.basename(dump_dir)])
      else
        dump_dirs = old_dump_dirs.sort
        keep_dirs = dump_dirs.shift(KEEP_OLD_DUMP_DIRS)
        kill_old_dump_dirs(dump_dirs)
        keep_dirs.reverse.each { |dir| rename_old_dump_dir(dir) }
      end
    end

    private

    # Lazy initialisation and create initial dump dir
    def ensure_initialized
      lazy_init
      ensure_dump_dir
    end

    # Lazy initialisation.
    def lazy_init
      return if @initialized

      @initialized = true
      log.info("Devicegraph dump directory: #{dump_dir}")
      reset
    end

    # Return the next numeric prefix for the numbered devicegraph files.
    # Each call to this increments the number.
    #
    # @return [String]
    def next_prefix
      ensure_initialized
      @prefix = @prefix.next
      @prefix + "-"
    end

    # Common part for all dump methods.
    # Call this with a code block that does the actual dumping:
    #
    #   dump_internal(obj, "base") { |path| obj.save(path + ".xyz") }
    #
    # @param dump_obj [Object] object to dump
    # @param file_base_name [String]
    # @param block [Block] code block that does the actual dumping
    #
    # @return [String] file base name with numeric prefix actually used
    #
    def dump_internal(dump_obj, file_base_name, &block)
      return nil if dump_obj.nil?
      return nil unless block_given?

      ensure_initialized
      short_name = next_prefix + file_base_name
      file_base_path = dump_dir + "/" + short_name

      dump_class = dump_obj.class.to_s.gsub("Y2Storage::", "")
      log.info("Dumping #{dump_class} to #{short_name}")

      block.call(file_base_path)
      short_name # "01-probed", "02-staging", ...
    end

    # Return the old devicegraph dump directories for the installed system
    # currently found in base_dir: ["storage", "storage-01", "storage-02", ...]
    #
    # @return [Array<String>] directory names without path
    def old_dump_dirs
      Dir.entries(base_dir).select do |entry|
        entry.start_with?("storage") && entry != "storage-inst"
      end
    end

    # Make sure the current dump directory (and possibly all its parents) is
    # created.
    def ensure_dump_dir
      FileUtils.mkdir_p(dump_dir)
    end

    def clear_dump_dir
      remove_dir(dump_dir) if File.exist?(dump_dir)
      ensure_dump_dir
    end

    # Rename an old dump directory according to this schema:
    #
    #   mv storage-02 storage-03
    #   mv storage-01 storage-02
    #   mv storage    storage-01
    #
    # @param old_name [String] old directory name (without path)
    def rename_old_dump_dir(old_name)
      new_name =
        if old_name =~ /[0-9]+$/
          old_name.next
        else
          old_name + "-01"
        end
      log.info("Rotating devicegraph dump dir #{old_name} to #{new_name}")
      File.rename(base_dir + "/" + old_name, base_dir + "/" + new_name)
    end

    # Kill (recursively remove) old dump directories.
    #
    # @param dump_dirs [Array<String>] directory names (without path) to remove
    def kill_old_dump_dirs(dump_dirs)
      dump_dirs.each do |dir|
        next unless File.exist?(base_dir + "/" + dir)

        log.info("Removing old devicegraph dump dir #{dir}")
        FileUtils.remove_dir(base_dir + "/" + dir)
      end
    end

    # Check if this process is running with root privileges
    #
    # @return [Boolean]
    def running_as_root?
      Process.euid == 0
    end

    # Check if an object is some kind of rspec mocked object
    # (double or instance_double)
    #
    # @return [Boolean]
    def mocked_object?(obj)
      return false unless defined?(RSpec::Mocks::Double)
      return true if obj.is_a?(RSpec::Mocks::Double)
      return false unless defined?(RSpec::Mocks::InstanceVerifyingDouble)

      obj.is_a?(RSpec::Mocks::InstanceVerifyingDouble)
    end
  end
end
