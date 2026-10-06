# frozen_string_literal: true

require "yast"

Yast.import "Arch"
Yast.import "BootStorage"

require "bootloader/udev_mapping"

module Bootloader
  # Represents object that can set passed stage1 to proposed values.
  # It is highly coupled with Stage1 class and it is recommended to use
  # {Bootloader::Stage1#propose} instead of direct usage of this class.
  class Stage1Proposal
    include Yast::Logger

    # Sets passed stage1 to proposed values
    # @param [Bootloader::Stage1] stage1 where write proposal
    # @return [void]
    def self.propose(stage1)
      arch = Yast::Arch.architecture
      proposal = AVAILABLE_PROPOSALS[arch]

      proposal.new(stage1).propose

      log.info "proposed stage1 configuration #{stage1.inspect}"
    end

  protected

    attr_reader :stage1

    def initialize(stage1)
      @stage1 = stage1
    end

    # Set "boot_*" flags in the globals map according to the boot device selected
    # with parameter selected_location. Only a single boot device can be selected
    # with this function. The function cannot be used to set a custom boot device.
    # It will always be deleted.
    #
    # FIXME: `mbr_md is probably unneeded; AFA we can see, this decision is
    # automatic anyway and perl-Bootloader should be able to make it without help
    # from the user or the proposal.
    #
    # @param [Symbol, Array] selected_location symbol one of :boot, :root, :mbr,
    #   :extended, `none or Array with first value :custom and second device for
    #   custom devices
    def assign_bootloader_device(selected_location)
      log.info "assign bootloader device '#{selected_location.inspect}'"
      # first, default to all off:
      stage1.clear_devices

      case selected_location
      when :boot, :mbr
        method = (selected_location == :mbr) ? :boot_disk_names : :boot_partition_names
        devices = stage1.public_send(method)
        devices.each do |dev|
          stage1.add_udev_device(dev)
        end
      when :none then log.info "Resetting bootloader device"
      when Array
        if selected_location.first != :custom
          raise "Unknown value to select bootloader device #{selected_location.inspect}"
        end

        stage1.model.add_device(selected_location[1]) # add directly proposed value without changes
      else
        raise "Unknown value to select bootloader device #{selected_location.inspect}"
      end
    end

    # x86_64 specific stage1 proposal
    class X64 < Stage1Proposal
      def propose
        selected_location = propose_boot_location
        log.info "propose_x86 (#{selected_location})"

        # set active flag, if needed
        if selected_location == :mbr
          # We are installing into MBR:
          # If there is an active partition, then we do not need to activate
          # one (otherwise we do).
          # Reason: if we use our own MBR code, we do not rely on the activate
          # flag in the partition table to boot Linux. Thus, the activated
          # partition can remain activated, which causes less problems with
          # other installed OSes like Windows (older versions assign the C:
          # drive letter to the activated partition).
          used_disks = mbr_disks
          stage1.activate = used_disks.none? { |d| any_boot_flag_partition?(d) }
          stage1.generic_mbr = false
        else
          # if not installing to MBR, always activate (so the generic MBR will
          # boot Linux)
          stage1.activate = true
          stage1.generic_mbr = true
        end
      end

    private

      def any_boot_flag_partition?(disk)
        log.info "any_boot_flag_partition? #{disk.inspect}"
        return false unless disk&.partition_table

        legacy_boot = disk.partition_table.partition_legacy_boot_flag_supported?
        disk.partitions.any? do |p|
          legacy_boot ? p.legacy_boot? : p.boot?
        end
      end

      def devicegraph
        Y2Storage::StorageManager.instance.staging
      end

      def propose_boot_location
        selected_location = propose_location
        log.info "selected location #{selected_location.inspect}"

        assign_bootloader_device(selected_location)

        selected_location
      end

      def propose_location
        # If disk is gpt and there is no bios boot partition, try to use partition if can be used
        return :mbr unless stage1.can_use_boot?

        missing_bios_boot = mbr_disks.any? do |disk|
          disk.gpt? && disk.partitions.none? { |p| p.id.is?(:bios_boot) }
        end

        return :boot if missing_bios_boot

        # lets prefer for SLE15 MBR where possible to make life of users easier
        :mbr
      end

      def mbr_disks
        Yast::BootStorage.boot_disks
      end
    end

    # s390x specific stage1 proposal
    class S390 < Stage1Proposal
      def propose
        # s390 do not need any partition as it is stored to predefined zipl location
        assign_bootloader_device(:none)

        stage1.activate = false
        stage1.generic_mbr = false
      end
    end

    # ppc64le specific stage1 proposal
    class PPC < Stage1Proposal
      def propose
        partition = proposed_prep_partition
        if partition
          # ensure that stage1 device is in udev (bsc#1041692)
          udev_partition = UdevMapping.to_mountby_device(partition.name)
          assign_bootloader_device([:custom, udev_partition])

          # do not activate on gpt disks see (bnc#983194)
          stage1.activate = !partition.partitionable.gpt?
          stage1.generic_mbr = false
        # handle diskless setup, in such case do not write boot code anywhere
        # (bnc#874466)
        # we need to detect what is mount on /boot and if it is nfs, then just
        # skip this proposal. In other case if it is not nfs, then it is error
        # and raise exception.
        # powernv do not have prep partition, so we do not have any partition
        # to activate (bnc#970582)
        elsif Yast::BootStorage.boot_filesystem.is?(:nfs) ||
            Yast::Arch.board_powernv
          stage1.activate = false
          stage1.generic_mbr = false
          nil
        else
          raise "there is no prep partition"
        end
      end

    private

      # PReP partition to use for stage 1.
      # The logic to select PReP partition is the following (first matching):
      #   * newly created PReP partition
      #   * PReP partition which is on same disk as /boot
      #   * first available PReP partition
      #
      # TODO Improve logic to propose PReP partitions:
      #   for example, by creating a PReP partition in all disks.
      def proposed_prep_partition
        partitions = Yast::BootStorage.prep_partitions

        partition = partitions.find { |p| !p.exists_in_probed? }
        if partition
          log.info "using freshly created prep partition #{partition}"
          return partition
        end

        boot_disks = Yast::BootStorage.boot_disks
        partition = partitions.find { |p| boot_disks.include?(p.partitionable) }
        if partition
          log.info "using prep on boot disk #{partition}"
          return partition
        end

        log.info "nothing better so lets return first available prep"
        partitions.first
      end
    end

    AVAILABLE_PROPOSALS = { # rubocop:disable Style/MutableConstant default_proc conflict
      "i386"    => X64,
      "x86_64"  => X64,
      "s390_32" => S390,
      "s390_64" => S390,
      "ppc"     => PPC,
      "ppc64"   => PPC
    }
    AVAILABLE_PROPOSALS.default_proc = lambda { |_h, k| raise "unsupported architecture #{k}" }
  end
end
