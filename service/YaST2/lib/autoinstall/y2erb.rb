# Vendored from yast-autoyast2's autoinstallation/src/lib/autoinstall/y2erb.rb.
# This is a permanent fork (see service/YaST2/README.md): the `autoyast2-installation`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "erb"
require "y2storage"

module Y2Autoinstallation
  class Y2ERB
    def self.render(path)
      env = TemplateEnvironment.new
      template = ERB.new(File.read(path))
      template.result(env.public_bindings) # intentional send as it is private method
    end

    class TemplateEnvironment
      include Yast::Logger

      # @return [Boolean] whether the system is booted using EFI or not
      def boot_efi?
        Y2Storage::Arch.new.efiboot?
      end

      def hardware
        @hardware ||= Yast::SCR.Read(Yast::Path.new(".probe"))
      end

      # @return [Array<Hash>] list of info about disks. Info contain:
      #   `:vendor` of disk
      #   `:device` kernel name of device
      #   `:udev_names` list of udev names for given disk
      #   `:model` model name from sysfs
      #   `:serial` serial number of disk
      #   `:size` disk size in bytes [Integer]
      def disks
        return @disks if @disks

        @disks = []
        hardware["disk"].each do |disk|
          dev_name = ::File.basename(disk["dev_name"])
          result = {
            vendor:     disk["vendor"],
            device:     dev_name,
            udev_names: disk["dev_names"]
          }
          result[:model] = sys_block_value(dev_name, "device/model") || "Unknown"
          result[:serial] = sys_block_value(dev_name, "serial") || "Unknown"
          result[:size] = (sys_block_value(dev_name, "size") || "-1").to_i

          @disks << result
        end

        @disks
      end

      # @return [Array<Hash>] list of info about network cards. Info contain:
      #   `:vendor` of card
      #   `:device` name of device
      #   `:mac` mac address of card
      #   `:active` if card io is active [Boolean]
      #   `:link` if card link is up [Boolean]
      def network_cards
        return @network_cards if @network_cards

        @network_cards = []
        hardware["netcard"].each do |card|
          resource = card["resource"]
          mac = begin
            resource["hwaddr"].first["addr"]
          rescue StandardError
            ""
          end
          active = begin
            resource["io"].first["active"]
          rescue StandardError
            false
          end
          link = begin
            resource["link"].first["state"]
          rescue StandardError
            false
          end
          result = {
            vendor: card["vendor"],
            device: card["dev_name"],
            mac:    mac,
            active: active,
            link:   link
          }

          @network_cards << result
        end

        @network_cards
      end

      # @return [Hash] list of info about OS release. Info contain:
      #   `:name` human readable name of OS like `"openSUSE Tumbleweed"` or `"SLES"`
      #   `:version` of release like `"20200727"` or `"12.5"`
      #   `:id` id of OS like `"opensuse-tumbleweed"` or `"sles"`
      def os_release
        return @os_release if @os_release

        Yast.import "OSRelease"
        @os_release = {
          name:    Yast::OSRelease.ReleaseName,
          version: Yast::OSRelease.ReleaseVersion,
          id:      Yast::OSRelease.id
        }
      end

      # allow to use env bindings
      def public_bindings
        binding
      end

    private

      def sys_block_value(device, path)
        sys_path = "/sys/block/#{device}/"
        ::File.read(sys_path + path).strip
      rescue StandardError => e
        log.warn "read of #{sys_path + path} failed with #{e}"
        nil
      end
    end
  end
end
