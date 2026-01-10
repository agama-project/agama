# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/storage/config_checkers/base"
require "agama/storage/volume_templates_builder"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the filesystem config.
      class Filesystem < Base
        include Yast::I18n

        # @param config [#filesystem]
        # @param product_config [Agama::Config]
        def initialize(config, product_config)
          super()

          textdomain "agama"
          @config = config
          @product_config = product_config
        end

        # Filesystem config issues.
        #
        # @return [Array<Issue>]
        def issues
          return [] unless filesystem

          [
            missing_filesystem_issue,
            invalid_filesystem_issue
          ].compact
        end

      private

        # @return [#filesystem]
        attr_reader :config

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Configs::Filesystem, nil]
        def filesystem
          config.filesystem
        end

        # @return [Issue, nil]
        def missing_filesystem_issue
          return if filesystem.reuse?
          return if filesystem.type&.fs_type

          # TRANSLATORS: %s is replaced by a mount path (e.g., "/home").
          error(
            format(_("Missing file system type for '%s'"), filesystem.path),
            kind: IssueClasses::Config::NO_FILESYSTEM_TYPE
          )
        end

        # @return [Issue, nil]
        def invalid_filesystem_issue
          return if filesystem.reuse?

          type = filesystem.type&.fs_type
          return unless type

          path = filesystem.path
          types = suitable_filesystem_types(path)
          return if types.include?(type)

          # Let's consider a type as valid if the product does not define any suitable type.
          return if types.empty?

          error(
            format(
              # TRANSLATORS: %{filesystem} is replaced by a file system type (e.g., "Btrfs") and
              #   %{path} is replaced by a mount path (e.g., "/home").
              _("The file system type '%{filesystem}' is not suitable for '%{path}'"),
              filesystem: type.to_human_string,
              path:       path
            ),
            kind: IssueClasses::Config::WRONG_FILESYSTEM_TYPE
          )
        end

        # Suitable file system types for the given path.
        #
        # @param path [String, nil]
        # @return [Array<Y2Storage::Filesytems::Type>]
        def suitable_filesystem_types(path = nil)
          volume_builder.for(path || "").outline.filesystems
        end

        # @return [VolumeTemplatesBuilder]
        def volume_builder
          @volume_builder ||= VolumeTemplatesBuilder.new_from_config(product_config)
        end
      end
    end
  end
end
