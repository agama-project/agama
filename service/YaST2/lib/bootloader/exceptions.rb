# frozen_string_literal: true

require "yast"

module Bootloader
  # Base error class for all bootloader-related errors
  class BootloaderError < RuntimeError
  end

  # Error raised when an external system binary executed for bootloader fails
  class CommandError < BootloaderError
    include Yast::I18n

    attr_reader :description, :command, :stderr, :exit_code

    # @param description [String] description of what failed
    # @param exception [Cheetah::ExecutionFailed] the underlying execution failure
    def initialize(description, exception)
      textdomain "bootloader"
      @description = description
      @command = exception.commands
      @stderr = exception.stderr
      @exit_code = exception.status&.exitstatus

      parts = [description]
      parts << "Command `#{@command.inspect}`." if @command
      parts << "Error output: #{@stderr}" if @stderr && !@stderr.empty?

      super(parts.join("\n"))
    end
  end

  # Specialized error for grub2-install failures
  class GrubInstallError < CommandError
    def initialize(exception)
      super(_("Installing GRUB2 failed."), exception)
    end
  end

  # Specialized error for grub2-mkconfig failures
  class GrubConfigError < CommandError
    def initialize(exception)
      super(_("Generating GRUB2 configuration failed."), exception)
    end
  end

  # Specialized error for dracut regeneration failures
  class DracutError < CommandError
    def initialize(exception)
      super(_("Regenerating initrd with dracut failed."), exception)
    end
  end

  # Specialized error for sdbootutil failures
  class SdbootutilError < CommandError
    def initialize(description, exception)
      super(description, exception)
    end
  end

  # Represents error when during read it found bootloader name that is not supported.
  class UnsupportedBootloader < BootloaderError
    attr_reader :bootloader_name

    def initialize(bootloader_name)
      super "Uninitialized bootlader '#{bootloader_name}'"
      @bootloader_name = bootloader_name
    end
  end

  # universal exception when unrecoverable error found during parsing configuration
  # holds in {#reason} translated message what exactly is broken.
  class BrokenConfiguration < BootloaderError
    include Yast::I18n
    attr_reader :reason

    def initialize(msg)
      @reason = msg
      textdomain "bootloader"

      # TRANSLATORS: %s is translated description of error
      super _("Error reading the bootloader configuration files. " \
              "Please use YaST2 bootloader to fix it. Details: %s") % msg
    end
  end

  # Specialized exception for invalid by-path device names
  # (bsc#1122008, bsc#1116305)
  class BrokenByPathDeviceName < BootloaderError
    include Yast::I18n
    attr_reader :dev_name

    def initialize(dev_name)
      @dev_name = dev_name
      textdomain "bootloader"

      # TRANSLATORS: %s is the device name
      super _("Error reading the bootloader configuration files:\n" \
              "Invalid device name %s\n" \
              "\n" \
              "This by-path device name may have changed after a reboot\n" \
              "if the hardware or kernel parameters changed.\n" \
              "\n" \
              "Please use YaST2 bootloader to fix this.\n") % dev_name
    end
  end

  # Represent unsupported value in given option. Used mainly when value contain something that
  # bootloader does not understand yet.
  class UnsupportedOption < BootloaderError
    include Yast::I18n
    attr_reader :option

    def initialize(option)
      @reason = option
      textdomain "bootloader"

      # TRANSLATORS: %s is name of option that has unsupported value
      super _("Option '%s' contains an unrecognized value.\nYaST Bootloader cannot handle it.\n" \
              "Either the whole bootloader configuration needs to be proposed again\n" \
              "or YaST must quit and you can edit it manually.") % option
    end
  end

  # Represents error when serial console arguments are not valid
  class InvalidSerialConsoleArguments < BrokenConfiguration
    MESSAGE = "Invalid serial console arguments"
    def initialize(msg = MESSAGE)
      super
    end
  end

  class NoRoot < BootloaderError
  end
end
