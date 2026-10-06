# frozen_string_literal: true

require "yast"

require "cfa/matcher"
require "cfa/placer"

module Bootloader
  # Specialized class to handle CPU mitigation settings.
  # @see https://www.suse.com/support/kb/doc/?id=7023836
  class CpuMitigations
    include Yast::Logger
    include Yast::I18n
    extend Yast::I18n
    KERNEL_MAPPING = {
      nosmt:  "auto,nosmt",
      auto:   "auto",
      off:    "off",
      manual: nil
    }.freeze

    HUMAN_MAPPING = {
      nosmt:  N_("Auto + No SMT"),
      auto:   N_("Auto"),
      off:    N_("Off"),
      manual: N_("Manually")
    }.freeze

    attr_reader :value

    def initialize(value)
      textdomain "bootloader"

      @value = value
    end

    # NOTE: order of ALL is used also in UI as order of combobox.
    ALL = KERNEL_MAPPING.keys.map { |k| CpuMitigations.new(k) }
    DEFAULT = CpuMitigations.new(:auto)

    def self.from_kernel_params(kernel_params)
      log.info "kernel params #{kernel_params.inspect}"
      param = kernel_params.parameter("mitigations")
      log.info "mitigation param #{param.inspect}"
      param = nil if param == false
      reverse_mapping = KERNEL_MAPPING.invert

      if !reverse_mapping.key?(param)
        raise "Unknown mitigations value #{param.inspect} in the kernel command line, " \
              "supported values are: #{KERNEL_MAPPING.values.compact.map(&:inspect).join(", ")}."
      end

      new(reverse_mapping[param])
    end

    def self.from_string(string)
      raise "Unknown mitigations value #{string.inspect}" unless KERNEL_MAPPING.key?(string.to_sym)

      new(string.to_sym)
    end

    def to_human_string
      _(HUMAN_MAPPING[value])
    end

    def kernel_value
      KERNEL_MAPPING[value] or raise "Invalid value #{value.inspect}"
    end

    def modify_kernel_params(kernel_params)
      matcher = CFA::Matcher.new(key: "mitigations")

      kernel_params.remove_parameter(matcher)
      return if value == :manual

      # TODO: fix cfa_grub2 with replace placer
      kernel_params.add_parameter("mitigations", kernel_value)
      log.info "replacing old config with #{kernel_value}: #{kernel_params.inspect}"
    end
  end
end
