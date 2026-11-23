# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

# Helpers for the bootloader translation tests (see bootloader_test.rb).

require "yast"
require "yast/i18n"
require "yast2/execute"
require "cheetah"

# Observes the calls to Yast::I18n#textdomain and Yast::I18n#_ when a probe is active.
#
# The test environment has no /usr/share/YaST2/locale, so Yast::I18n#textdomain does nothing there
# and a translation can never be observed. The probe records instead, for every `_()` call,
# whether `textdomain "bootloader"` had been called on the receiver before. That is exactly the
# condition Yast::I18n#_ checks (@my_textdomain) before looking up a translation.
module BootloaderTextdomainProbe
  class << self
    # @return [Hash, nil] nil when no probe is active
    attr_accessor :state

    # Starts recording
    def start
      self.state = { domains: {}.compare_by_identity, calls: [] }
    end

    # Stops recording
    def stop
      self.state = nil
    end

    # Whether `_(msgid)` was called on an object (or class) which had configured the "bootloader"
    # textdomain, which is the precondition for the string to be translated.
    #
    # @param msgid [String]
    # @return [Boolean]
    def translatable?(msgid)
      calls_for(msgid).any? { |c| c[:domains].include?("bootloader") }
    end

    # Whether `_(msgid)` was called, but never on an object with the textdomain configured, so
    # the string can never be translated.
    #
    # @param msgid [String]
    # @return [Boolean]
    def never_translated?(msgid)
      calls = calls_for(msgid)
      !calls.empty? && calls.none? { |c| c[:domains].include?("bootloader") }
    end

    # @param msgid [String]
    # @return [Array<Hash>]
    def calls_for(msgid)
      state[:calls].select { |c| c[:msgid] == msgid }
    end
  end

  # @see Yast::I18n#textdomain
  def textdomain(domain)
    if (state = BootloaderTextdomainProbe.state)
      (state[:domains][self] ||= []) << domain
    end
    super
  end

  # @see Yast::I18n#_
  def _(str)
    if (state = BootloaderTextdomainProbe.state)
      state[:calls] << { msgid: str, domains: (state[:domains][self] || []).dup }
    end
    super
  end
end

# It does nothing unless BootloaderTextdomainProbe.start was called.
Yast::I18n.prepend(BootloaderTextdomainProbe) unless
  Yast::I18n.ancestors.include?(BootloaderTextdomainProbe)

# Helpers to fake the execution of external commands
module BootloaderExecuteHelpers
  # @param command [Array<String>]
  # @return [Cheetah::ExecutionFailed]
  def execution_failure(command)
    Cheetah::ExecutionFailed.new(command, double(exitstatus: 1), "", "boom")
  end

  # Fakes Yast::Execute.on_target! so that the commands starting with the given words fail and any
  # other command succeeds without running anything.
  #
  # @param failing [Array<String>, nil] first words of the command that has to fail
  # @param outputs [Hash{Array<String> => String}] output of the commands starting with the words
  def fake_execute(failing = nil, outputs: {})
    allow(Yast::Execute).to receive(:on_target!) do |*args, **_opts|
      command = args.flatten
      raise execution_failure(command) if failing && command.first(failing.size) == failing

      _words, output = outputs.find { |words, _| command.first(words.size) == words }
      output || (command.first == "/usr/bin/bootctl" ? "[]" : "")
    end
  end
end
