# frozen_string_literal: true

require "yast"
require "singleton"

require "bootloader/exceptions"
require "bootloader/device_path"
require "y2storage"

Yast.import "Mode"

module Bootloader
  # Class manages mapping between udev names of disks and partitions.
  class UdevMapping
    include Singleton
    include Yast::Logger
    include Yast::I18n

    # make more comfortable to work with singleton
    class << self
      extend Forwardable
      def_delegators :instance,
        :to_kernel_device,
        :to_mountby_device
    end

    # Converts full udev name to kernel device ( disk or partition )
    # @param dev [String] device udev, mdadm or kernel name like /dev/disk/by-id/blabla
    # @raise when device have udev format but do not exists
    # @return [String,nil] kernel device or nil when running AutoYaST configuration.
    def to_kernel_device(dev)
      textdomain "bootloader"
      log.info "call to_kernel_device for #{dev}"
      raise "invalid device nil" unless dev

      # method udev_to_kernel works also for alternative raid names (bnc#944041)
      udev_to_kernel(dev)
    end

    # Converts udev or kernel device (disk or partition) to udev name that fits best.
    #
    # The strategy to discover the best udev name is delegated to storage-ng, see
    # Y2Storage::Filesystems::BlkFilesystem#preferred_name
    #
    # @param dev [String] device udev or kernel one like /dev/disk/by-id/blabla
    # @return [String] udev name
    def to_mountby_device(dev)
      kernel_dev = to_kernel_device(dev)

      log.info "#{dev} looked as kernel device name: #{kernel_dev}"

      kernel_to_udev(kernel_dev)
    end

  private

    def staging
      Y2Storage::StorageManager.instance.staging
    end

    def udev_to_kernel(dev)
      dev_path = DevicePath.new(dev)

      # in mode config if not found, then return itself
      return dev if Yast::Mode.config
      # in installation do not care of uuids - not know at this time
      return dev if Yast::Mode.installation && dev_path.uuid?

      device = staging.find_by_any_name(dev)

      if device.nil?
        # TRANSLATORS: error message, %s stands for problematic device.
        raise(Bootloader::BrokenConfiguration, _("Unknown udev device '%s'") % dev)
      end

      # As wire devices have identical udev devices as its multipath device,
      # we must ensure we are using the multipath device and not the wire
      multipath = device.descendants.find { |i| i.is?(:multipath) }
      device = multipath if device.is?(:disk) && multipath

      device.name
    end

    # Udev name for the device
    #
    # The selected udev name depends on the mount by option. In case of an unmounted device,
    # storage-ng has logic to discover the preferred mount by option.
    #
    # @see #to_mountby_device
    #
    # @return [String]
    def kernel_to_udev(dev)
      device = Y2Storage::BlkDevice.find_by_name(staging, dev)
      if device.nil?
        log.error "Cannot find #{dev}"
        return dev
      end

      result = udev_name_for(device)
      log.info "udev device for #{dev.inspect} is #{result.inspect}"

      result
    end

    # picks udev name according to strategy
    # @see #to_mountby_device
    def udev_name_for(device)
      if device.filesystem
        log.info "udev_name_for: using the preferred name for the filesystem"
        device.filesystem.preferred_name
      else
        log.info "udev_name_for: using the preferred name for the block device"
        device.preferred_name
      end
    end
  end
end
