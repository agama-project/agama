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

module DInstaller
  # Class to pass around to get progress info. Intention is to allow
  # in long run methods like probe or commit to pass its progress report
  # when UI asks for it.
  #
  # The class contain major and minor steps. Intention is that
  # top level manager knows about major steps and sets total and current step.
  # On other hand each step called by manager class sets minor steps and messages if needed.
  # If steps do not set it, it is manager responsibility to set defaults for minor steps and
  # good message for given step.
  #
  # @example manager interaction
  #
  #   progress = Progress.new
  #   progress.total_steps = 3
  #   progress.current_step = 0
  #   progress.reset_minor_steps
  #   progress.message = "Doing step1"
  #   step1(progress)
  #   progress.current_step = 1
  #   progress.reset_minor_steps
  #   progress.message = "Doing step2"
  #   step2(progress)
  #   progress.current_step = 2
  #   progress.reset_minor_steps
  #   progress.message = "Doing step3"
  #   step3(progress)
  #   progress.current_step = 3
  #   progress.message = "Finished with steps"
  #
  class Progress
    def initialize
      @message = ""
      @total_steps = @current_step = @total_minor_steps = @current_minor_step = 0
    end

    attr_accessor :message
    attr_accessor :total_steps
    attr_accessor :current_step
    attr_accessor :total_minor_steps
    attr_accessor :current_minor_step

    def reset_minor_steps
      @total_minor_steps = @current_minor_step = 0
    end
  end
end

