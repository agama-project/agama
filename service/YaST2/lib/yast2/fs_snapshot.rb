# ***************************************************************************
#
# Copyright (c) [2015-2019] SUSE LLC
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File: fs_snapshot.rb
#
# Authors:
#  Imobach Gonzalez Sosa <igonzalezsosa@suse.com>

require "yast"
require "date"
require "yast2/execute"
require "shellwords"
require "csv"

module Yast2
  # Represents the fact that Snapper is not configured for "/" (root).
  class SnapperNotConfigured < StandardError
    def initialize
      super "Programming error: Snapper is not configured yet."
    end
  end

  # Represents that a Snapper configuration was attempted at the wrong time or
  # system, since it's only possible in a fresh installation after software
  # installation.
  class SnapperNotConfigurable < StandardError
    def initialize
      super "Programming error: Snapper cannot be configured at this point."
    end
  end

  # Represents that does not exist a suitable 'pre' snapshot for a new 'post'
  # snapshot.
  class PreviousSnapshotNotFound < StandardError
    def initialize
      super "Previous snapshot was not found."
    end
  end

  # Represents the fact that the snapshot could not be created.
  class SnapshotCreationFailed < StandardError
    def initialize
      super "Filesystem snapshot could not be created."
    end
  end

  # Class for managing filesystem snapshots. It's important to note that this
  # class is intended to be used during installation/update so it uses the
  # Snapper's CLI because the DBus interface is not available at that time.
  class FsSnapshot
    include Yast::Logger

    Yast.import "Linuxrc"
    Yast.import "Mode"

    FIND_CONFIG_CMD =
      "/usr/bin/snapper --no-dbus --root=%{root} --csvout list-configs " \
      "--columns config,subvolume | /usr/bin/grep \"^root,\" >/dev/null".freeze

    CREATE_SNAPSHOT_CMD = "/usr/bin/snapper --no-dbus --root=%{root} create "\
                          "--type %{snapshot_type} --description %{description}".freeze

    LIST_SNAPSHOTS_CMD =
      "/usr/bin/snapper --no-dbus --root=%{root} --utc --csvout list --disable-used-space " \
      "--columns number,type,pre-number,date,user,cleanup,description".freeze

    # Predefined snapshot cleanup strategies (the user can define custom ones, too)
    CLEANUP_STRATEGY = { number: "number", timeline: "timeline" }.freeze

    attr_reader :number, :snapshot_type, :previous_number, :timestamp, :user, :cleanup_algo, :description

    # FsSnapshot constructor
    #
    # This method is not intended to be called by users of FsSnapshot class.
    # Instead, class methods must be used.
    #
    # @param number          [Fixnum]        Snapshot's number.
    # @param snapshot_type   [Symbol]        Snapshot's type: :pre, :post or :single.
    # @param previous_number [Fixnum, nil]   Previous snapshot's number; nil if the snapshot has no pre
    #                                        snapshot associated to it.
    # @param timestamp       [DateTime, nil] Timestamp; nil if the datetime is unknown.
    # @param user            [String, nil]   Snapshot's owner username; nil if the owner is unknown.
    # @param cleanup_algo    [Symbol, nil]   Clean-up algorithm; nil if the algorithm is unknown.
    # @param description     [String, nil]   Snapshot's description; nil if the snapshot has no
    #                                        description.
    # @return [FsSnapshot] New FsSnapshot object.
    def initialize(number, snapshot_type, previous_number, timestamp, user, cleanup_algo, description)
      @number = number
      @snapshot_type = snapshot_type
      @previous_number = previous_number
      @timestamp = timestamp
      @user = user
      @cleanup_algo = cleanup_algo
      @description = description
    end

    private_class_method :new

    # Returns the previous snapshot
    #
    # @return [FsSnapshot, nil] Object representing the previous snapshot.
    def previous
      @previous ||= @previous_number ? FsSnapshot.find(@previous_number) : nil
    end

    # Class methods
    # FIXME: This class has too many class methods (even some state at class
    # level). It would probably make sense to extract some of that stuff (like
    # code related to Snapper configuration) to a separate class.
    class << self
      # Determines whether snapper is configured or not
      #
      # @return [Boolean] true if it's configured; false otherwise.
      def configured?
        return @configured unless @configured.nil?

        out = Yast::SCR.Execute(
          Yast::Path.new(".target.bash_output"),
          format(FIND_CONFIG_CMD, root: target_root.shellescape)
        )

        log.info("Checking if Snapper is configured: \"#{FIND_CONFIG_CMD}\" returned: #{out}")
        @configured = out["exit"] == 0
      end

      # Performs the final steps to configure snapper for the root filesystem on a
      # fresh installation.
      #
      # First part of the configuration must have been already done while the root
      # filesystem is created.
      #
      # This part here is what is left to do after the package installation in the
      # target system is complete.
      #
      # @raise [SnapperNotConfigurable] unless called in an already chrooted fresh
      #   installation
      def configure_snapper
        raise SnapperNotConfigurable if !Yast::Mode.installation || non_switched_installation?

        @configured = nil

        installation_helper_step4
        write_snapper_config
        update_etc_sysconfig_yast2
        setup_snapper_quota
      end

      # Whether Snapper should be configured at the end of installation
      #
      # @return [Boolean]
      def configure_on_install?
        !!@configure_on_install
      end

      # @see #configure_on_install?
      attr_writer :configure_on_install

      # Returns whether creating the given snapshot type is allowed
      # Information is taken from Linuxrc (DISABLE_SNAPSHOTS)
      #   * "all" - all snapshot types are temporarily disabled
      #   * "around" - before and after calling YaST
      #   * "single" - single snapshot at a given point
      #
      # @param [Symbol] one of :around (for :post and :pre snapshots) or :single
      # @return [Boolean] if snapshot should be created
      def create_snapshot?(snapshot_type)
        disable_snapshots = Yast::Linuxrc.value_for(Yast::LinuxrcClass::DISABLE_SNAPSHOTS)

        # Feature is not defined on Linuxrc commandline
        return true if disable_snapshots.nil? || disable_snapshots.empty?

        disable_snapshots = disable_snapshots.downcase.tr("-_.", "").split(",")

        if [:around, :single].include?(snapshot_type)
          return false if disable_snapshots.include?("all")

          !disable_snapshots.include?(snapshot_type.to_s)
        else
          raise ArgumentError, "Unsupported snapshot type #{snapshot_type.inspect}, " \
                               "supported are :around and :single"
        end
      end

      # Creates a new 'single' snapshot unless disabled by user
      #
      # @param description [String]  Snapshot's description.
      # @param cleanup     [String]  Cleanup strategy (:number, :timeline, nil)
      # @param important   [boolean] Add "important" to userdata?
      # @return [FsSnapshot] The created snapshot.
      #
      # @see FsSnapshot.create
      # @see FsSnapshot.create_snapshot?
      def create_single(description, cleanup: nil, important: false)
        return nil unless create_snapshot?(:single)

        create(:single, description, cleanup: cleanup, important: important)
      end

      # Creates a new 'pre' snapshot
      #
      # @param description [String] Snapshot's description.
      # @return [FsSnapshot] The created snapshot.
      #
      # @see FsSnapshot.create
      # @see FsSnapshot.create_snapshot?
      def create_pre(description, cleanup: nil, important: false)
        return nil unless create_snapshot?(:around)

        create(:pre, description, cleanup: cleanup, important: important)
      end

      # Creates a new 'post' snapshot unless disabled by user
      #
      # Each 'post' snapshot corresponds with a 'pre' one.
      #
      # @param description     [String]  Snapshot's description.
      # @param previous_number [Fixnum]  Number of the previous snapshot
      # @param cleanup         [String]  Cleanup strategy (:number, :timeline, nil)
      # @param important       [boolean] Add "important" to userdata?
      # @return [FsSnapshot] The created snapshot.
      #
      # @see FsSnapshot.create
      # @see FsSnapshot.create_snapshot?
      def create_post(description, previous_number, cleanup: nil, important: false)
        return nil unless create_snapshot?(:around)

        previous = find(previous_number)

        if previous
          create(:post, description, previous: previous, cleanup: cleanup, important: important)
        else
          log.error "Previous filesystem snapshot was not found"
          raise PreviousSnapshotNotFound
        end
      end

      # Returns all snapshots
      #
      # It raises an exception if Snapper is not configured.
      #
      # @note Unlike other class methods which inspect the underlying system,
      #   this method does not cache any result. It always queries snapper
      #   about existing snapshots.
      #
      # @return [Array<FsSnapshot>] All snapshots that exist in the system.
      def all
        raise SnapperNotConfigured unless configured?

        out = Yast::SCR.Execute(
          Yast::Path.new(".target.bash_output"),
          format(LIST_SNAPSHOTS_CMD, root: target_root.shellescape)
        )

        log.info("Retrieving snapshots list: #{LIST_SNAPSHOTS_CMD} returned: #{out}")

        csv = CSV.parse(out["stdout"], headers: true, converters: [:date_time, :numeric])

        csv.each_with_object([]) do |row, snapshots|
          next if row[0] == 0 # Ignores 'current' snapshot (id = 0) because it's not a real snapshot

          fields = row.fields

          if !fields[3].is_a?(DateTime)
            log.warn("Error when parsing date/time: #{fields[3]}")
            fields[3] = nil
          end

          fields[1] = fields[1].to_sym # type
          fields[5] = fields[5].to_sym if fields[5] # cleanup

          snapshots << new(*fields)
        end
      end

      # Finds a snapshot by its number
      #
      # It raises an exception if Snapper is not configured.
      #
      # @param nubmer [Fixnum] Number of the snapshot to search for.
      # @return [FsSnapshot,nil] The snapshot with the number +number+ if found.
      #                          Otherwise, it returns nil.
      # @see FsSnapshot.all
      def find(number)
        all.find { |s| s.number == number }
      end

    private

      # Creates a new snapshot unless disabled by user
      #
      # It raises an exception if Snapper is not configured or if snapshot
      # creation fails.
      #
      # @param snapshot_type [Symbol]    Snapshot's type: :pre, :post or :single.
      # @param description   [String]    Snapshot's description.
      # @param previous      [FsSnashot] Previous snapshot.
      # @param cleanup       [String]    Cleanup strategy (:number, :timeline, nil)
      # @param important     [boolean]   Add "important" to userdata?
      # @return [FsSnapshot] The created snapshot if the operation was
      #                      successful.
      def create(snapshot_type, description, previous: nil, cleanup: nil, important: false)
        raise SnapperNotConfigured unless configured?

        cmd = format(CREATE_SNAPSHOT_CMD,
          root:          target_root.shellescape,
          snapshot_type: snapshot_type.to_s.shellescape,
          description:   description.shellescape)
        cmd << " --pre-num #{previous.number.to_s.shellescape}" if previous
        cmd << " --userdata \"important=yes\"" if important

        if cleanup
          strategy = CLEANUP_STRATEGY[cleanup]
          cmd << " --cleanup #{strategy.shellescape}" if strategy
        end

        log.info("Executing: \"#{cmd}\"")
        out = Yast::SCR.Execute(Yast::Path.new(".target.bash_output"), cmd)

        if out["exit"] == 0
          all.last
        else
          log.error "Snapshot could not be created: #{cmd} returned: #{out}"
          raise SnapshotCreationFailed
        end
      end

      # detects if module runs in initial stage before scr is switched to target system
      def non_switched_installation?
        Yast.import "Stage"
        return false unless Yast::Stage.initial

        !Yast::WFM.scr_chrooted?
      end

      # Gets target directory on which should snapper operate
      def target_root
        return "/" unless non_switched_installation?

        Yast.import "Installation"

        Yast::Installation.destdir
      end

      # Executes the fourth step of the installation-helper of Snapper.
      #
      # Unfortunately the steps of the Snapper helper are not much descriptive.
      # The step 4 must be executed in the target system after installing the
      # packages and before using snapper for the first time.
      def installation_helper_step4
        Yast::Execute.on_target("/usr/lib/snapper/installation-helper", "--step", "4")
      end

      def write_snapper_config
        config = [
          "NUMBER_CLEANUP=yes", "NUMBER_LIMIT=2-10", "NUMBER_LIMIT_IMPORTANT=4-10", "TIMELINE_CREATE=no"
        ]
        Yast::Execute.on_target("/usr/bin/snapper", "--no-dbus", "set-config", *config)
      end

      def update_etc_sysconfig_yast2
        Yast::SCR.Write(Yast.path(".sysconfig.yast2.USE_SNAPPER"), "yes")
        Yast::SCR.Write(Yast.path(".sysconfig.yast2"), nil)
      end

      def setup_snapper_quota
        Yast::Execute.on_target("/usr/bin/snapper", "--no-dbus", "setup-quota")
      end
    end
  end
end
