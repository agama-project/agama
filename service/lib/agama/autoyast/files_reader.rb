# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "yast"

# :nodoc:
module Agama
  module AutoYaST
    # Builds the Agama "files" section from an AutoYaST profile.
    class FilesReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash corresponding to Agama "files" section.
      #
      # If there is no files-related information, it returns an empty hash.
      #
      # @return [Hash] Agama "files" section
      def read
        return {} if profile["files"].nil?

        # files section contains list of file nodes.
        # supported file sub-elements:
        # - file_location (a file source path) (-> source)
        # - file_contents (a file content) (-> source)
        # - file_path (this one seems to be the only mandatory,
        #             a file destination or directory to be created if ends with '/')
        #             (-> destination)
        # - file_owner (-> owner)
        # - file_permissions (permissions)
        #
        # unsupported for now:
        # - file_script
        files = profile.fetch_as_array("files")

        files_json = files.map do |f|
          file = file_source(f)
          file = file.merge(file_owner(f))

          file["destination"] = f["file_path"] if f["file_path"]
          file["permissions"] = f["file_permissions"] if f["file_permissions"]

          file
        end

        { "files" => files_json }
      end

    private

      attr_reader :profile

      def file_source(file)
        return {} if file.nil? || file.empty?

        if file.key?("file_location")
          { "url" => file["file_location"] }
        elsif file.key?("file_contents")
          { "content" => file["file_contents"] }
        else
          {}
        end
      end

      def file_owner(file)
        res = {}
        return res if file.nil? || file.empty? || !file["file_owner"]

        user, group = file["file_owner"].split(".", 2)

        res["user"] = user if user
        res["group"] = group if group

        res
      end
    end
  end
end
