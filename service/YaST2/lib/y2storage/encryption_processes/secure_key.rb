# Copyright (c) [2019-2025] SUSE LLC
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

require "fileutils"
require "yast2/execute"
require "y2storage/encryption_processes/apqn"
require "y2storage/encryption_processes/secure_key_volume"
require "yast"

module Y2Storage
  module EncryptionProcesses
    # Class representing the secure AES keys managed by the Crypto Express CCA
    # coprocessors found in the system.
    #
    # For more information, see
    # https://www.ibm.com/support/knowledgecenter/linuxonibm/com.ibm.linux.z.lxdc/lxdc_zkey_reference.html
    class SecureKey
      include Yast::Logger

      # Location of the zkey command
      ZKEY = "/usr/bin/zkey".freeze
      private_constant :ZKEY

      # Default location of the zkey repository
      DEFAULT_REPO_DIR = File.join("/", "etc", "zkey", "repository")
      private_constant :DEFAULT_REPO_DIR

      # @return [String] name of the secure key
      attr_reader :name

      # @return [Integer, nil] sector size in bytes
      attr_reader :sector_size

      # Constructor
      #
      # @note: creating a SecureKey object does not generate a new record for it
      # in the keys database. See {#generate}.
      #
      # @param name [String] see {#name}
      # @param sector_size [Integer, nil] see {#sector_size}
      # @param apqns [Array<Apqn>] APQNs to use for generating the secure key
      # @param key_type [String, nil] type of the generated secure key
      def initialize(name, sector_size: nil, apqns: [], key_type: nil)
        @name = name
        @volume_entries = []
        @sector_size = sector_size
        @apqns = apqns
        @key_type = key_type
      end

      # Whether the key contains an entry in its list of volumes referencing the
      # given device
      #
      # @param device [BlkDevice, Encryption] it can be the plain device being
      #   encrypted or the resulting encryption device
      # @return [Boolean]
      def for_device?(device)
        !!volume_entry(device)
      end

      # DeviceMapper name registered in this key for the given device
      #
      # @param device [BlkDevice, Encryption] it can be the plain device being
      #   encrypted or the resulting encryption device
      # @return [String, nil] nil if the current key contain no information
      #   about the device or whether it does not specify a DeviceMapper name
      #   for it
      def dm_name(device)
        volume_entry(device)&.dm_name
      end

      # For the given device, name with which the plain device is registered
      # in this key
      #
      # @param device [BlkDevice, Encryption] it can be the plain device being
      #   encrypted or the resulting encryption device
      # @return [String, nil] nil if the current key contain no information
      #   about the device
      def plain_name(device)
        volume_entry(device)&.plain_name
      end

      # Adds the given device to the list of volumes registered for this key
      #
      # @note This only modifies the current object in memory, it does not imply
      #   saving the volume entry in the keys database.
      #
      # @param device [Encryption]
      # @return [SecureKeyVolume] the newly added SecureKeyVolume
      def add_device(device)
        @volume_entries << SecureKeyVolume.new_from_encryption(device)
        @volume_entries.last
      end

      # Adds the given device to the list of volumes registered for this key
      #
      # @param device [Encryption]
      # @return [SecureKeyVolume] the newly added SecureKeyVolume
      def add_device_and_write(device)
        secure_key_volume = add_device(device)

        Yast::Execute.locally(ZKEY, "change", "--name", name, "--volumes",
          "+#{secure_key_volume}")

        secure_key_volume
      end

      # Registers the key in the keys database by invoking "zkey generate"
      #
      # The generated key will have the name and the list of volumes from this
      # object. The rest of attributes will be set at the convenient values for
      # pervasive LUKS2 encryption, see {#generate_args}.
      def generate
        Yast::Execute.locally(ZKEY, "generate", *generate_args)
      end

      # Registers the key in the keys database by invoking "zkey generate"
      #
      # @see #generate
      #
      # @raise [Cheetah::ExecutionFailed] when the generation fails
      def generate!
        Yast::Execute.locally!(ZKEY, "generate", *generate_args)
      end

      # Removes a key from the keys database by invoking "zkey remove"
      def remove
        Yast::Execute.locally!(ZKEY, "remove", "--force", "--name", name)
      rescue Cheetah::ExecutionFailed => e
        log.error("Error removing the key - #{e.message}")
      end

      # Parses the representation of a secure key, in the format used by
      # "zkey list", and adds the corresponding volume entries to the list of
      # volumes registered for this key
      #
      # @note This only modifies the current object in memory, it does not imply
      #   saving the volume entries in the keys database.
      #
      # @param string [String] portion of the output of "zkey list" that
      #   represents a concrete secure key
      def add_zkey_volumes(string)
        # TODO: likely this method could be better implemented with
        # StringScanner

        vol_pattern = "\s+\/[^\s]*\s*\n"
        match_data = /\s* Volumes\s+:((#{vol_pattern})+)/.match(string)
        return [] unless match_data

        volumes_str = match_data[1]
        volumes = volumes_str.split("\n").map(&:strip)

        @volume_entries += volumes.map { |str| SecureKeyVolume.new_from_str(str) }
      end

      # Full filename of the secure key file.
      #
      # @return [String]
      def filename
        File.join(repo_dir, name + ".skey")
      end

      # Size of the secure key in bytes
      #
      # @return [Integer] zero if the secure key is still not generated
      def secure_key_size
        # This could also be obtained from "zkey list" but this seems more direct, likely "zkey list"
        # simply does the same check
        File.size(filename)
      rescue SystemCallError
        # According to a comment at jsc#IBM-1444, assuming a reasonable default size would not be safe
        # since those default sizes can change in the future
        0
      end

      # Copies the files of this key from the current keys repository to the
      # repository of a target system
      #
      # @param base_dir [String] base directory where the target system is
      #   mounted, typically Yast::Installation.destdir
      def copy_to_repository(base_dir)
        target = repository_path(base_dir)
        return unless File.exist?(target)

        log.info "Copying files of key #{name} to #{target}"
        FileUtils.cp_r(Dir.glob("#{repository_path}/#{name}.*"), target, preserve: true)
        target_stat = File.stat(target)
        FileUtils.chown_R(target_stat.uid, target_stat.gid, Dir.glob("#{target}/#{name}.*"))
      rescue StandardError => e
        log.error "Error copying the key - #{e.message}"
      end

      private

      # @return [Array<SecureKeyVolume>] entries in the "volumes" section of
      #   this key
      attr_accessor :volume_entries

      # @return [Array<Apqn>]
      attr_reader :apqns

      # @return [String, nil]
      attr_reader :key_type

      # Volume entry associated to the given device
      #
      # @param device [BlkDevice, Encryption] it can be the plain device being
      #   encrypted or the resulting encryption device
      # @return [SecureKeyVolume, nil] nil if this key is not associated to the
      #   device
      def volume_entry(device)
        volume_entries.find { |vol| vol.match_device?(device) }
      end

      # Full path of the zkey repository for the system mounted at the given
      # location
      #
      # @param base_dir [String] mount point of the system, "/" means the
      #   currently running system
      # @return [String]
      def repository_path(base_dir = "/")
        (base_dir == "/") ? repo_dir : File.join(base_dir, DEFAULT_REPO_DIR)
      end

      # Full path of the current zkey repository
      #
      # @return [String]
      def repo_dir
        ENV["ZKEY_REPOSITORY"] || DEFAULT_REPO_DIR
      end

      # Arguments to be used with the "zkey generate" command
      #
      # @return [Array<String>]
      def generate_args
        args = [
          "-V",
          "--name", name,
          "--xts",
          "--keybits", "256",
          "--volume-type", "LUKS2"
        ]

        args += ["--sector-size", sector_size.to_s] if sector_size

        args += ["--volumes", volume_entries.map(&:to_s).join(",")] if volume_entries.any?

        args += ["--apqns", apqns.map(&:name).join(",")] if apqns.any?

        args += ["--key-type", key_type] if key_type

        args
      end

      class << self
        # Whether it's possible to use secure AES keys in this system
        #
        # @return [Boolean]
        def available?
          Apqn.online.any?(&:master_key_pattern)
        end

        # Registers a new secure key in the system's key database
        #
        # The name of the resulting key may be different (a numbered suffix is
        # added) if the given name is already taken.
        #
        # @param name [String] tentative name for the new key
        # @param sector_size [Integer,nil] sector size to set in the register.
        #   Use the nil to use the system's default.
        # @param volumes [Array<Encryption>] encryption devices to register in
        #   the "volumes" section of the new key
        # @param apqns [Array<Apqn>] APQNs to use
        # @param key_type [String, nil] type of the generated secure key
        #
        # @return [SecureKey] an object representing the new key
        def generate(name, sector_size: nil, volumes: [], apqns: [], key_type: nil)
          key = new_for_generate(
            name, sector_size: sector_size, volumes: volumes, apqns: apqns, key_type: key_type
          )

          key.generate

          key
        end

        # Registers a new secure key in the system's key database
        #
        # @see #generate
        #
        # @raise [Cheetah::ExecutionFailed] when the generation fails
        def generate!(name, sector_size: nil, volumes: [], apqns: [], key_type: nil)
          key = new_for_generate(
            name, sector_size: sector_size, volumes: volumes, apqns: apqns, key_type: key_type
          )

          key.generate!

          key
        end

        # Finds an existing secure key that references the given device in
        # one of its "volumes" entries
        #
        # @param device [BlkDevice] Block device to search the secure key for
        # @return [SecureKey, nil] nil if no key is found for the device
        def for_device(device)
          all.find { |key| key.for_device?(device) }
        end

        # Parses the representation of a secure key, in the format used by
        # "zkey list", and returns a SecureKey object representing it
        #
        # @param string [String] portion of the output of "zkey list" that
        #   represents a concrete secure key
        def new_from_zkey(string)
          lines = string.lines
          attrs = lines.map { |l| l.split(":", 2) }.each_with_object({}) do |parts, all|
            next if parts.size != 2

            all[parts[0].strip] = parts[1].strip
          end
          sector_size = attrs["Sector size"].start_with?(/\d/) ? attrs["Sector size"].to_i : nil
          key = new(attrs["Key"], sector_size: sector_size)
          key.add_zkey_volumes(string)
          key
        end

        private

        # All secure keys registered in the system
        #
        # @return [Array<SecureKey>]
        def all
          output = Yast::Execute.locally(ZKEY, "list", stdout: :capture)
          return [] if output&.empty?

          entries = output&.split("\n\n") || []
          entries.map { |entry| new_from_zkey(entry) }
        end

        # Creates a new secure key ready to be generated in the system (i.e., with an exclusive name and
        # with the associated volumes).
        #
        # @return [SecureKey]
        def new_for_generate(name, sector_size: nil, volumes: [], apqns: [], key_type: nil)
          name = exclusive_name(name)
          key = new(name, sector_size: sector_size, apqns: apqns, key_type: key_type)
          volumes.each { |v| key.add_device(v) }

          key
        end

        # Returns the name that is available for a new key taking original_name
        # as a base. If the name is already taken by an existing key in the
        # system, the returned name will have a number appended.
        #
        # @param original_name [String]
        # @return [String]
        def exclusive_name(original_name)
          existing_names = all.map(&:name)
          return original_name unless existing_names.include?(original_name)

          suffix = 0
          name = "#{original_name}_#{suffix}"
          while existing_names.include?(name)
            suffix += 1
            name = "#{original_name}_#{suffix}"
          end
          name
        end
      end
    end
  end
end
