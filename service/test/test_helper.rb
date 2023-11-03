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

require "yast"
require "yast/rspec"

SRC_PATH = File.expand_path("../lib", __dir__)
FIXTURES_PATH = File.expand_path("fixtures", __dir__)
$LOAD_PATH.unshift(SRC_PATH)

require "agama/product_reader" # to globally mock reading real products

# make sure we run the tests in English locale
# (some tests check the output which is marked for translation)
ENV["LC_ALL"] = "en_US.UTF-8"

# Hack to avoid requiring some files
# Initially introduced because yast2-s390 is only available for s390x systems
# (but we want to run the DASD-related unit tests in all architectures).
LIBS_TO_SKIP = ["y2s390", "y2s390/format_process", "y2s390/zfcp"].freeze
module Kernel
  alias_method :old_require, :require

  def require(path)
    old_require(path) unless LIBS_TO_SKIP.include?(path)
  end
end

RSpec.configure do |c|
  c.before do
    allow(Agama::ProductReader).to receive(:new)
      .and_return(double(load_products: []))
  end
end

if ENV["COVERAGE"]
  require "simplecov"
  SimpleCov.start do
    add_filter "/test/"
  end

  # track all ruby files under src
  SimpleCov.track_files("#{SRC_PATH}/**/*.rb")

  # additionally use the LCOV format for on-line code coverage reporting at CI
  if ENV["CI"] || ENV["COVERAGE_LCOV"]
    require "simplecov-lcov"

    SimpleCov::Formatter::LcovFormatter.config do |c|
      c.report_with_single_file = true
      # this is the default Coveralls GitHub Action location
      # https://github.com/marketplace/actions/coveralls-github-action
      c.single_report_path = "coverage/lcov.info"
    end

    formatters = [
      SimpleCov::Formatter::HTMLFormatter, SimpleCov::Formatter::LcovFormatter
    ]
    SimpleCov.formatter = SimpleCov::Formatter::MultiFormatter.new(formatters)
  end
end
