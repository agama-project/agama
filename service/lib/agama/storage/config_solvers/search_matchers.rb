# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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

module Agama
  module Storage
    module ConfigSolvers
      # Namespace for matchers used for searching devices.
      #
      # There is a matcher for each type of searchable device (e.g., {SearchMatchers::Drive}).
      # Each matcher supports the conditions that make sense for its subject, see
      # {SearchMatchers::Base}.
      #
      # The composite conditions (filesystem and partitions) are leaves of the condition tree of
      # a device, but their content refers to another subject. Their evaluation is delegated to
      # {SearchMatchers::FilesystemCondition} and {SearchMatchers::PartitionsCondition}. Both are
      # matchers whose {SearchMatchers::Base#match?} method is overridden to receive the device,
      # so they can resolve their own subject (the filesystem of the device and each partition of
      # the device, respectively) and evaluate the nested conditions against it.
      #
      # Note the leaf mixins of {SearchMatchers::PartitionsCondition} and the ones of
      # {SearchMatchers::Partition} (the matcher used for searching partitions) are independent
      # declarations, even if both lists coincide today. Each class can grow or drop leaves on its
      # own, since the conditions nested into a quantifier and the conditions of a partition search
      # are two different things.
      module SearchMatchers
      end
    end
  end
end

require "agama/storage/config_solvers/search_matchers/base"
require "agama/storage/config_solvers/search_matchers/with_name"
require "agama/storage/config_solvers/search_matchers/with_size"
require "agama/storage/config_solvers/search_matchers/with_driver"
require "agama/storage/config_solvers/search_matchers/with_boss"
require "agama/storage/config_solvers/search_matchers/with_partition_number"
require "agama/storage/config_solvers/search_matchers/with_partition_id"
require "agama/storage/config_solvers/search_matchers/with_filesystem"
require "agama/storage/config_solvers/search_matchers/with_partitions"
require "agama/storage/config_solvers/search_matchers/filesystem_condition"
require "agama/storage/config_solvers/search_matchers/partitions_condition"
require "agama/storage/config_solvers/search_matchers/drive"
require "agama/storage/config_solvers/search_matchers/md_raid"
require "agama/storage/config_solvers/search_matchers/partition"
require "agama/storage/config_solvers/search_matchers/logical_volume"
require "agama/storage/config_solvers/search_matchers/volume_group"
