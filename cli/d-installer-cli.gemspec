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

Gem::Specification.new do |spec|
  spec.name = "d-installer-cli"
  spec.version = File.read(File.expand_path("VERSION", File.join(__dir__, ".."))).chomp
  spec.summary = "D-Installer CLI"
  spec.description = "Command line interface for D-Installer service"
  spec.author = "YaST Team"
  spec.email = "yast-devel@opensuse.org"
  spec.homepage = "https://github.com/yast/d-installer"
  spec.license = "GPL-2.0-only"
  spec.files = Dir["lib/**/*.rb", "bin/*", "share/*", "etc/*", "[A-Z]*"]
  spec.executables << "dinstallerctl"
  spec.metadata = { "rubygems_mfa_required" => "true" }

  spec.required_ruby_version = ">= 2.5.0"

  spec.add_development_dependency "packaging_rake_tasks", "~> 1.5.1"
  spec.add_development_dependency "rake", "~> 13.0.6"
  spec.add_development_dependency "rspec", "~> 3.11.0"
  spec.add_development_dependency "simplecov", "~> 0.21.2"
  spec.add_development_dependency "simplecov-lcov", "~> 0.8.0"
  spec.add_runtime_dependency "thor", "~> 1.2", ">= 1.2.1"
  spec.add_dependency "fast_gettext", "~> 2.2.0"
  spec.add_dependency "ruby-dbus", ">= 0.18.0.beta5"
end
