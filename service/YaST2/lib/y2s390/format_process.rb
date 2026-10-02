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

# Vendored from yast2-s390's src/lib/y2s390/format_process.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-s390` RPM
# is no longer a runtime dependency of Agama.

require "yast"
require "yast2/execute"

module Y2S390
  # This class is responsible for maintaining an specific DASD format progress
  class FormatStatus
    attr_accessor :progress, :cylinders, :dasd

    # Constructor
    #
    # @param dasd [Dasd]
    # @param cylinders [Ingeger]
    # @param format_size [Integer]
    def initialize(dasd, cylinders, format_size = 10)
      @dasd = dasd
      @cylinders = cylinders
      @progress = 0
      @size = format_size
    end

    # It increments the progress status based on the configured format size
    def update_progress!
      @progress += @size
    end

    # Return whether the format progress has been completed according to the number of cylinders
    #
    # @return [Boolean] whether the format progress has been completed or not
    def done?
      # We need to add a partial step to cover the case when the number of cylinders is not
      # multiple of the format size. e.g: cylinders: 10016, format_size: 10
      @progress + (@size - 1) >= @cylinders
    end
  end

  # This class is responsible of formatting a set of DASD volumes maintaining also the status of the
  # progress.
  #
  # Once the format process has been started it allows to check the status of the process, the
  # output and also the stderr.
  #
  # @example
  #
  #   process = Y2S390::FormatProcess.new(dasds_list)
  #   process.start
  #   process.initialize_summary
  #   while process.running?
  #     process.update_summary
  #     sleep(0.2)
  #   end
  #   report_error if process.status.to_i != 0
  #
  # @see https://github.com/yast/yast-core/blob/master/agent-process/doc/ag_process_example.ycp
  class FormatProcess
    include Yast::Logger
    attr_accessor :id, :dasds, :summary, :updated

    FORMAT_CMD = "/sbin/dasdfmt".freeze
    SIZE = 10

    # Constructor
    #
    # @param dasds [Array<Y2S390::Dasd>]
    def initialize(dasds)
      @dasds = dasds
      @summary = {}
      @updated = {}
    end

    # Convenience method to start with the formatting process
    def start
      @id = Yast::SCR.Execute(Yast.path(".process.start_shell"), format_cmd)
    end

    # Checks whether the formatting process is still running or not
    #
    # @return [Boolean] true when running; false otherwise
    def running?
      return false unless @id

      Yast::SCR.Read(Yast.path(".process.running"), @id)
    end

    # Returns one line from stdout of the process or nil in case of not started.
    #
    # @return [String, nil]
    def read_line
      return unless @id

      Yast::SCR.Read(Yast.path(".process.read_line"), @id)
    end

    # Returns the output of the process or nil in case of not started. The output could contain
    # newline characters as it is not line-oriented.
    #
    # @return [String, nil]
    def read
      return unless @id

      Yast::SCR.Read(Yast.path(".process.read"), @id)
    end

    # Returns the status of the process or nil in case of not started
    #
    # @returns [String, nil]
    def status
      return unless @id

      Yast::SCR.Read(Yast.path(".process.status"), @id)
    end

    # Returns one line from stderr of the process
    #
    # @returns [String]
    def error
      stderr = []
      loop do
        line = Yast::SCR.Read(Yast.path(".process.read_line_stderr"), @id)
        break unless line

        stderr << line
      end

      stderr.join(" ")
    end

    # Initializes the summary for the DASDs given in the constructor
    def initialize_summary
      dasds.each_with_index { |d, i| @summary[i] = FormatStatus.new(d, read_line.to_i) }
    end

    # Update the summary of the formatting progress reading the output of the format process
    def update_summary
      @updated = {}

      line = read

      return unless line

      log.debug "Updating Summary"
      progress = line.gsub(/[[:space:]]/, "").split("|")
      progress.each do |d|
        next if d.to_s.empty?

        index = d.to_i

        summary[index]&.update_progress!
        @updated[index] = summary[index]
      end
      log.debug "The summary is #{summary.inspect}"
      log.debug "Updated #{updated.inspect}"

      updated
    end

    # Total number of cylinders to be formatted
    #
    # @return [Integer]
    def cylinders
      summary.values.inject(0) { |sum, v| sum + v.cylinders }
    end

    # Current progress according to the cylinders formatted
    #
    # @return [Integer]
    def progress
      summary.values.inject(0) { |sum, v| sum + v.progress }
    end

  private

    # Convenience method to obtain the complete format command to be used according to the DASDs
    # given in the constructor
    def format_cmd
      "#{FORMAT_CMD} -Y -P #{dasds.size} -b 4096 -y -r #{SIZE} -m #{SIZE} #{disks_params}"
    end

    # Convenience method to obtain parameter of the devices to be formatted
    def disks_params
      dasds.map { |d| "-f #{d.device_path}" }.join(" ")
    end
  end
end
