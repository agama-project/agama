# frozen_string_literal: true

require "yast"
require "y2storage"

module Bootloader
  # Class for device path
  #
  # @example device path can be defined explicitly
  #   DevicePath.new("/devs/sda")
  # @example definition by UUID is translated to device path
  #   dev = DevicePath.new("UUID=\"0000-00-00\"")
  #   dev.path -> "/dev/disk/by-uuid/0000-00-00"
  class DevicePath
    attr_reader :path

    # Performs initialization
    #
    # @param dev [<String>] either a path like /dev/sda or special string for uuid or label
    def initialize(dev)
      dev = dev.strip

      @path = if dev_by_uuid?(dev)
        # if defined by uuid, convert it
        dev.sub(/UUID="([-a-zA-Z0-9]*)"/, '/dev/disk/by-uuid/\1')
      elsif dev_by_label?(dev)
        # as well for label
        dev.sub(/LABEL="(.*)"/, '/dev/disk/by-label/\1')
      else
        # add it exactly (but whitespaces) as specified by the user
        dev
      end
    end

    # @return [Boolean] true if the @path exists in the system
    def exists?
      !devicegraph.find_by_any_name(path).nil?
    end

    alias_method :valid?, :exists?

    def uuid?
      !!(path =~ /by-uuid/)
    end

    def label?
      !!(path =~ /by-label/)
    end

  private

    def dev_by_uuid?(dev)
      dev =~ /UUID=".+"/
    end

    def dev_by_label?(dev)
      dev =~ /LABEL=".+"/
    end

    def devicegraph
      if Yast::Mode.installation
        Y2Storage::StorageManager.instance.staging
      else
        Y2Storage::StorageManager.instance.system
      end
    end
  end
end
