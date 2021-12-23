require "yast2/dbus_client"

class ApplicationController < ActionController::API

  private

  def client
    @client ||= Yast2::DBusClient.new
  end
end
