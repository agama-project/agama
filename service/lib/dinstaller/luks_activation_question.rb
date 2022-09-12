# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "dinstaller/question"

module DInstaller
  # This class represent a question to ask whether to activate a LUKS device
  #
  # Clients have to answer one of these options:
  #   * skip: to skip the activation of the LUKS device
  #   * decrypt: to activate the device using the provided password
  #
  # @example
  #   question = LuksActivationQuestion.new("/dev/sda1", label: "mydata", size: "10 GiB")
  #   question.password = "n0ts3cr3t"
  #
  #   question.answer = :skip    # in case you do not want to activate the device
  #
  #   question.answer = :decrypt # in case you want to decrypt with the given password
  class LuksActivationQuestion < Question
    # @return [String]
    attr_reader :device

    # @return [String, nil]
    attr_reader :label

    # @return [String, nil]
    attr_reader :size

    # Current attempt to decrypt the device
    #
    # @return [Integer]
    attr_reader :attempt

    # Constructor
    #
    # @param device [String] name of the device to be activated (e.g., "/dev/sda1")
    # @param label [String, nil] label of the device
    # @param size [String, nil] size of the device (e.g., "5 GiB")
    def initialize(device, label: nil, size: nil, attempt: 1)
      @device = device
      @label = label
      @size = size
      @attempt = attempt

      super(generate_text, options: [:skip, :decrypt])
    end

    # Password to activate the LUKS device
    #
    # @return [String, nil] nil means a password has not been provided yet
    attr_accessor :password

  private

    # Generate the text for the question
    #
    # @return [String]
    def generate_text
      "The device #{device_info} is encrypted. Do you want to decrypt it?"
    end

    # Device information to include in the question
    #
    # @return [String]
    def device_info
      info = [device]
      info << label unless label.to_s.empty?
      info << "(#{size})" unless size.to_s.empty?

      info.join(" ")
    end
  end
end
