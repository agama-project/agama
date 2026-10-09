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

require "cfa/base_model"

module Yast
  # A file handler suitable for CFA::BaseModel (from config_files_api.gem)
  # that respects Yast::Installation.destdir. When this class is `require`d,
  # it is assigned to CFA::BaseModel.default_file_handler.
  class TargetFile
    # Reads file content with respect of changed root in installation.
    def self.read(path)
      ::File.read(final_path(path))
    end

    # Writes file content with respect of changed root in installation.
    def self.write(path, content)
      ::File.write(final_path(path), content)
    end

    def self.final_path(path)
      root = Yast::WFM.scr_root

      ::File.join(root, path)
    end
    private_class_method :final_path
  end
end

CFA::BaseModel.default_file_handler = Yast::TargetFile
