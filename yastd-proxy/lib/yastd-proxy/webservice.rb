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

require "sinatra/base"
require "sinatra/cors"
require "rack/contrib"
require "yastd-proxy/dbus_client"

class WebService < Sinatra::Base
  register Sinatra::Cors
  use Rack::JSONBodyParser

  set :allow_origin, "http://localhost:3000"
  set :allow_methods, "GET,HEAD,POST,PUT"
  set :allow_headers, "content-type,if-modified-since"
  set :expose_headers, "location,link"

  set :default_content_type, :json

  get "/properties" do
    client.get_properties.to_json
  end

  get "/properties/:name" do
    client.get_property(params[:name]).to_json
  end

  put "/properties/:name" do
    client.set_property(params[:name], params[:value])
  rescue Yast2::DBusClient::CouldNotSetProperty => e
    puts "Could not set property: #{e.inspect}"
  end

  post "/calls" do
    ret = client.call(params["meth"])
    ret[0].to_json
  end

  def client
    @client ||= Yast2::DBusClient.new
  end
end
