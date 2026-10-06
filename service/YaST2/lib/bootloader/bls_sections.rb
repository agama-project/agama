# frozen_string_literal: true

require "json"
require "yast"
require "yast2/execute"
require "bootloader/bls"

Yast.import "Misc"
Yast.import "Mode"
Yast.import "Stage"

module Bootloader
  # Represents available sections and handling of default BLS boot entry
  class BlsSections
    include Yast::Logger
    include Yast::I18n

    # @return [Array<String>] list of all available boot titles
    # or an empty array
    attr_reader :all

    # @return [String] title of default boot section.
    attr_reader :default

    def initialize
      textdomain "bootloader"

      @all = []
      @default = ""
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
      return if @default.empty?

      set = @data.find { |d| d["title"] == @default }
      Bls.write_default_menu(set["id"]) if set
    end

    def read
      @data = read_entries
      @all = @data.map { |e| e["title"] if e["type"] == "type1" }.compact
      file = Bls.default_menu.strip
      set = @data.find { |d| d["id"] == file }
      set ||= @data.first
      @default = set["title"] if set
    end

  private

    # @return [Array] return array of entries or []
    def read_entries
      begin
        output = Yast::Execute.on_target!(
          "/usr/bin/bootctl", "--json=short", "list", stdout: :capture
        )
      rescue Cheetah::ExecutionFailed => e
        error_message = format(_(
                                 "Cannot read boot menu entry:\n" \
                                 "Command `%{command}`.\n" \
                                 "Error output: %{stderr}"
                               ), command: e.commands.inspect, stderr: e.stderr)
        if Yast::Stage.initial && Yast::Mode.update
          Yast::Report.Warning(error_message)
        else
          Yast::Report.Error(error_message)
        end
      end
      return [] if output.nil?

      JSON.parse(output)
    end
  end
end
