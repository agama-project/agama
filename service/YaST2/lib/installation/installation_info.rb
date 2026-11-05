# Copyright (c) [2021] SUSE LLC
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

require "singleton"
require "yaml"

require "yast"

module Installation
  #
  # Class which collects all installation/update information in order
  # to write it into the /var/log/YaST2/installation_info directory
  # when the process has been finished correctly or the process has
  # crashed.
  #
  # The implementation uses a callback mechanism to allow easily extending the
  # logged data, it avoids circular dependencies between packages and easily handles
  # optional YaST modules (e.g. the registration module is not present in the
  # openSUSE Leap installer).
  #
  # The callbacks also ensure that we really log the current values at the time
  # of writing the dump file.
  #
  # @example Registering a custom callback
  # ::Installation::InstallationInfo.instance.add_callback("my_module") do
  #   {
  #     "foo" => foo.value,
  #     "bar" => bar.value
  #   }
  # end
  #
  # @example Dumping the data when an error occurs
  # if failed
  #   ::Installation::InstallationInfo.instance.write(
  #     "Setting foo option failed",
  #     additional_info: "File foo does not exist"
  #   )
  # end
  class InstallationInfo
    include Singleton
    include Yast::Logger

    LOGDIR = "/var/log/YaST2/installation_info/".freeze

    include Yast::Logger

    def initialize
      # index of the saved file to have unique file names
      self.index = 0

      # Function calls which has been set by other modules,
      # these functions will be called while generating the output.
      # The return value (usually a Hash) of each call will be logged into the output file.
      # Uses "id" => block mapping
      @callbacks = {}
    end

    # Register a block which will be called while generating the data file.
    #
    # @param name [String] id of the function call, using the same id
    #   will overwrite the previous setting, use the module/package name
    #   to avoid conflicts
    def add_callback(name, &block)
      return unless block_given?

      log.info("Adding callback #{name.inspect}")
      callbacks[name] = block
    end

    # is the callback already registered?
    # @param name [String] name of the callback
    # @return [Boolean] `true` if registered, `false` otherwise
    def callback?(name)
      callbacks.key?(name)
    end

    # Collects the data and writes the dump into an YAML file.
    #
    # @param description [String] description of data, e.g. what happened
    # @param additional_info [Object] optional additional information
    # @param path [String,nil] path to the saved dump file,
    #   uses the default path if `nil`
    # @return [String] path to the written file
    def write(description, additional_info: nil, path: nil)
      file = path || File.join(LOGDIR, "dump_#{Process.pid}_#{format("%03d", index)}.yml")
      log.info("Writing installation information to #{file}")

      # the collected data
      data = {
        "description" => description
      }

      data["additional_info"] = additional_info if additional_info

      @callbacks.each do |name, callback|
        data[name] = callback.call
      end

      ::FileUtils.mkdir_p(File.dirname(file))
      File.write(file, data.to_yaml)

      # increase the file counter for the next file
      self.index += 1

      file
    end

  protected

    attr_reader :callbacks
    attr_accessor :index
  end
end
