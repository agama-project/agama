# frozen_string_literal: true

require "yast"

Yast.import "Arch"

module Bootloader
  # Represents parameters for console. Its main intention is easy parsing serial
  # console parameters parameters for grub or kernel and generate it to keep it
  # in sync.
  class SerialConsole
    PARITY_MAP = {
      "n" => "no",
      "o" => "odd",
      "e" => "even"
    }.freeze
    SPEED_DEFAULT = 9600
    PARITY_DEFAULT = "no"
    WORD_DEFAULT = ""

    # REGEXP that separate usefull parts of kernel parameter for serial console
    # matching groups are:
    #
    # 1. serial console device
    # 2. console unit
    # 3. speed of serial console ( baud rate )
    # 4. parity of serial console ( just first letter )
    # 5. word length for serial console
    #
    # For details see https://en.wikipedia.org/wiki/Serial_port
    # @example serial console param ( on kernel cmdline "console=<example>" )
    #    "ttyS0,9600n8"
    # @example also partial specification works
    #    "ttyAMA1"
    KERNEL_PARAM_REGEXP = /(ttyS|ttyAMA)([[:digit:]]*),?([[:digit:]]*)([noe]*)([[:digit:]]*)/.freeze

    # Loads serial console configuration from parameters passed to kernel
    # @param [ConfigFiles::Grub2::Default::KernelParams] kernel_params to read
    # @return [Bootloader::SerialConsole,nil] returns nil if none found,
    #   otherwise instance of SerialConsole
    def self.load_from_kernel_args(kernel_params)
      console_parameters = kernel_params.parameter("console")
      return nil unless console_parameters

      console_parameters = Array(console_parameters)
      # use only the last parameter (bnc#870514)
      serial_console = console_parameters.last
      return nil if serial_console !~ /ttyS/ && serial_console !~ /ttyAMA/

      unit = serial_console[KERNEL_PARAM_REGEXP, 2]
      return nil if unit.empty?

      speed = serial_console[KERNEL_PARAM_REGEXP, 3]
      speed = SPEED_DEFAULT if speed.empty?
      parity = serial_console[KERNEL_PARAM_REGEXP, 4]
      parity = PARITY_DEFAULT[0] if parity.empty?
      parity = PARITY_MAP[parity]
      word = serial_console[KERNEL_PARAM_REGEXP, 5]

      new(unit, speed, parity, word)
    end

    # Loads serial console configuration from parameters passed to grub
    # @param [String] console_args string passed to grub as configuration
    # @return [Bootloader::SerialConsole,nil] returns nil if none found,
    #   otherwise instance of SerialConsole
    # @example
    #   console_arg = "serial --speed=38400 --unit=0 --word=8 --parity=no --stop=1"
    #   SerialConsole.load_from_console_args(console_arg)
    def self.load_from_console_args(console_args)
      unit = console_args[/--unit=(\S+)/, 1]
      return nil unless unit

      speed = console_args[/--speed=(\S+)/, 1] || SPEED_DEFAULT
      parity = console_args[/--parity=(\S+)/, 1] || PARITY_DEFAULT
      word = console_args[/--word=(\S+)/, 1] || WORD_DEFAULT

      new(unit, speed, parity, word)
    end

    # constuctor
    # @param unit [String] serial console unit
    # @param speed [String] speed how console can communicate
    # @param parity [String] if partity can be used. For possible values see grub2 documentation.
    # @param word [String] word size. If empty then default is used.
    # @see https://www.gnu.org/software/grub/manual/grub.html#serial
    def initialize(unit, speed = SPEED_DEFAULT, parity = PARITY_DEFAULT,
      word = WORD_DEFAULT)
      @unit = unit
      @speed = speed
      @parity = parity
      @word = word
    end

    # generates kernel argument usable for passing it with `console=<result>`
    def kernel_args
      serial_console = Yast::Arch.aarch64 ? "ttyAMA" : "ttyS"

      "#{serial_console}#{@unit},#{@speed}#{@parity[0]}#{@word}"
    end

    # generates serial command for grub2 GRUB_SERIAL_COMMAND
    def console_args
      res = "serial --unit=#{@unit} --speed=#{@speed} --parity=#{@parity}"
      res += " --word=#{@word}" unless @word.empty?

      res
    end

    # generates serial console parameters for grub2
    # GRUB_CMDLINE_LINUX_XEN_REPLACE_DEFAULT
    def xen_kernel_args
      # This is always hvc0 (for HyperVisor Console).
      "console=hvc0"
    end

    # generates serial console parameters for grub2
    # GRUB_CMDLINE_XEN_DEFAULT
    def xen_hypervisor_args
      # Notice that this is always com1, even if the host uses another serial tty.
      # See also https://wiki.xenproject.org/wiki/Xen_Serial_Console
      "console=com1 com1=#{@speed}"
    end
  end
end
