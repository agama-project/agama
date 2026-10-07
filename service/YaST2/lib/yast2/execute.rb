# ***************************************************************************
#
# Copyright (c) 2015 SUSE LLC
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************

require "yast"
require "cheetah"
require "forwardable"

module Yast
  # A module for executing scripts/programs in a safe way
  # (not prone to shell quoting bugs).
  # It uses {http://www.rubydoc.info/github/openSUSE/cheetah/ Cheetah}
  # as the backend, but adds support for chrooting during the installation.
  # It also globally switches the default Cheetah logger to
  # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
  #
  # To limit logging sensitive input/output/arguments,
  # you can pass a {ReducedRecorder} as the *recorder* option.
  #
  # @example Methods of this class can be chained.
  #
  #   Yast::Execute.locally!.stdout("ls", "-l")
  #   Yast::Execute.stdout.on_target!("ls", "-l")
  class Execute
    include Yast::I18n

    # use y2log by default
    Cheetah.default_options = { logger: Y2Logger.instance }

    class << self
      extend Forwardable

      def_delegators :new, :on_target, :on_target!, :locally, :locally!, :stdout
    end

    # Constructor
    #
    # @param options [Hash<Symbol, Object>] options to add for the execution. Some of
    #   these options are directly passed to Cheetah#run, and others are used to control
    #   the behavior when running commands (e.g., to indicate if a popup should be shown
    #   when the command fails). See {#options}.
    def initialize(options = {})
      textdomain "base"

      @options = options
    end

    # Runs with chroot; a failure becomes a popup.
    # Runs a command described by *args*,
    # in a `chroot(2)` specified by the installation (WFM.scr_root).
    # Shows a {ReportClass#Error popup} if the command fails
    # and returns `nil` in such case.
    # It also globally switches the default Cheetah logger to
    # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    def on_target(*args)
      chaining_object(yast_popup: true).on_target!(*args)
    end

    # Runs with chroot; a failure becomes an exception.
    # Runs a command described by *args*,
    # in a `chroot(2)` specified by the installation (WFM.scr_root).
    # It also globally switches the default Cheetah logger to
    # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    # @raise Cheetah::ExecutionFailed if the command fails
    def on_target!(*args)
      root = Yast::WFM.scr_root

      chaining_object(chroot: root).run_or_chain(args)
    end

    # Runs without chroot; a failure becomes a popup.
    # Runs a command described by *args*,
    # *disregarding* a `chroot(2)` specified by the installation (WFM.scr_root).
    # Shows a {ReportClass#Error popup} if the command fails
    # and returns `nil` in such case.
    # It also globally switches the default Cheetah logger to
    # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    def locally(*args)
      chaining_object(yast_popup: true).locally!(*args)
    end

    # Runs without chroot; a failure becomes an exception.
    # Runs a command described by *args*,
    # *disregarding* a `chroot(2)` specified by the installation (WFM.scr_root).
    # It also globally switches the default Cheetah logger to
    # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    # @raise Cheetah::ExecutionFailed if the command fails
    def locally!(*args)
      run_or_chain(args)
    end

    # Runs a command described by *args* and returns its output
    #
    # It also globally switches the default Cheetah logger to
    # {http://www.rubydoc.info/github/yast/yast-ruby-bindings/Yast%2FLogger Y2Logger}.
    #
    # @param args [Array<Object>] see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    # @return [String] command output or an empty string if the command fails.
    def stdout(*args)
      chaining_object(yast_stdout: true, stdout: :capture).run_or_chain(args)
    end

  protected

    # Decides either to run the command or to chain the call in case that no argmuments
    # are given.
    #
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    # @return [Object, ExecuteClass] result of running the command or a chaining object.
    def run_or_chain(args)
      args.none? ? self : run(*args)
    end

  private

    # Options to add when running a command
    #
    # Some options are intended to control the behavior and they are not passed to
    # Cheetah.run. For example:
    #
    # * `yast_popup`: to indicate whether a popup should be shown when the command fails.
    # * `yast_stdout`: to indicate whether the command always should return an output,
    #     even when it fails.
    #
    # @return [Hash<Symbol, Object>]
    attr_reader :options

    # New object to chain method calls
    #
    # The new object contains current object options plus given new options.
    #
    # @param new_options [Hash<Symbol, Object>]
    # @return [ExecuteClass]
    def chaining_object(new_options)
      self.class.new(options.merge(new_options))
    end

    # Runs the given command
    #
    # It takes into account the object options when running the command.
    # Note that `yast_popup` takes precedence over `yast_stdout`. So, when both options
    # are active and the command fails, a popup error is shown instead of forcing a
    # command output. Moreover, when any of such options is active, bang methods like
    # {#on_target!} and {#locally!} do not raise an exception.
    #
    # @example
    #
    #   Yast::Execute.locally.stdout("false")   #=> error popup is shown
    #
    #   Yast::Execute.locally!("false")         #=> Cheetah::ExecutionFailed
    #   Yast::Execute.stdout.locally!("false")  #=> ""
    #
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    def run(*args)
      new_args = merge_options(args)

      block = proc { Cheetah.run(*new_args) }

      if yast_popup?
        popup_error(&block)
      elsif yast_stdout?
        force_stdout(&block)
      else
        block.call
      end
    end

    # Add object options to the given command
    #
    # @param args see http://www.rubydoc.info/github/openSUSE/cheetah/Cheetah.run
    # @return [Array<Object>]
    def merge_options(args)
      options = command_options

      if options.any?
        args << {} unless args.last.is_a?(Hash)
        args.last.merge!(options)
      end

      args
    end

    # Object options could contain some options to define the behavior when running
    # a command (e.g., `yast_popup` and `yast_stdout`). These options are filtered out.
    #
    # @return [Hash<Symbol, Object>]
    def command_options
      opts = options.dup

      opts.delete_if { |k, _| k.to_s.start_with?("yast") }
    end

    # Whether `yast_popup` option is active
    #
    # @return [Boolean]
    def yast_popup?
      !!options[:yast_popup]
    end

    # Whether `yast_stdout` option is active
    #
    # @return [Boolean]
    def yast_stdout?
      !!options[:yast_stdout]
    end

    # Runs the command and shows a popup when the command fails
    def popup_error(&block)
      block.call
    rescue Cheetah::ExecutionFailed => e
      Yast.import "Report"

      Yast::Report.Error(
        format(_(
                 "Execution of command \"%{command}\" failed.\n"\
                 "Exit code: %{exitcode}\n"\
                 "Error output: %{stderr}"
               ), command: e.commands.inspect, exitcode: e.status.exitstatus, stderr: e.stderr)
      )
    end

    # Runs the command and returns an empty string when the command fails
    def force_stdout(&block)
      block.call
    rescue Cheetah::ExecutionFailed
      ""
    end
  end

  # specific recorder which can be used when some sensitive information that
  # should not go to log
  class ReducedRecorder < Cheetah::DefaultRecorder
    # @param skip [Array<Symbol>|Symbol] possible symbols are `:stdin`,
    #   `:stdout`, `:stderr` and `:args`. Those streams won't be recorded.
    def initialize(skip: [], logger: Y2Logger.instance)
      super(logger)

      skip = Array(skip)

      skip.each do |m|
        method = PARAM_MAPPING[m]
        raise ArgumentError, "Invalid value '#{m.inspect}'" unless method

        define_singleton_method(method) { |_| } # intentionally empty
      end
    end

    PARAM_MAPPING = {
      stdin:  :record_stdin,
      stdout: :record_stdout,
      stderr: :record_stderr,
      args:   :record_commands
    }.freeze
    private_constant :PARAM_MAPPING
  end
end
