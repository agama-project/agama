class PropertiesController < ApplicationController
  def index
    render json: client.get_properties
  end

  def show
    render json: client.get_property(params[:name])
  end

  def update
    client.set_property(params[:name], params[:value])
    render :ok
  rescue ::DBus::Error => e
    render json: { status: "error", message: e.message }
  end
end
