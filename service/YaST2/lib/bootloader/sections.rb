# frozen_string_literal: true

require "yast"
require "yast2/execute"

Yast.import "Stage"

module Bootloader
  # Represents available sections and handling of default boot entry
  class Sections
    include Yast::Logger

    # @return [Array<String>] list of all available boot titles if initialized
    #   with grub_cfg otherwise it is empty array
    attr_reader :all

    # @return [String] title of default boot section. It is not full path,
    #   so it should be reasonable short
    attr_reader :default

    # @param [CFA::Grub2::GrubCfg, nil] grub_cfg - loaded parsed grub cfg tree
    # or nil if not available yet
    def initialize(grub_cfg = nil)
      @data = grub_cfg ? grub_cfg.boot_entries : []
      @all = @data.map { |e| e[:title] }
      @default = grub_cfg ? read_default : ""
    end

    # Sets default section internally.
    # @param [String] value of new boot title to boot
    # @note to write it to system use #write later
    def default=(value)
      log.info "set new default to '#{value.inspect}'"

      # empty value mean no default specified
      if !all.empty? && !all.include?(value) && !value.empty?
        log.warn "Invalid value #{value} trying to set as default. Fallback to default"
        value = ""
      end

      @default = value
    end

    # writes default to system making it persistent
    def write
      return if default.empty?

      Yast::Execute.on_target("/usr/sbin/grub2-set-default", title_to_path(default))
    end

  private

    # @return [String] return default boot path as string or "" if not set
    #   or something goes wrong
    # @note shows error popup if calling grub2-editenv failed
    def read_default
      # Execute.on_target can return nil if call failed. It shows users error popup, but bootloader
      # can continue with empty default section
      saved = Yast::Execute.on_target("/usr/bin/grub2-editenv", "list", stdout: :capture) || ""
      saved_line = saved.lines.grep(/saved_entry=/).first || ""

      default_path = saved_line[/saved_entry=(.*)$/, 1]

      default_path ? path_to_title(default_path) : all.first || ""
    end

    # @return [String] convert grub boot path to title that can be displayed. If
    # entry not found, then return argument
    def path_to_title(path)
      entry = @data.find { |e| e[:path] == path }

      entry ? entry[:title] : path
    end

    # @return [String] convert displayable title to grub boot path. If
    # entry not found, then return argument
    def title_to_path(title)
      entry = @data.find { |e| e[:title] == title }

      entry ? entry[:path] : title
    end
  end
end
