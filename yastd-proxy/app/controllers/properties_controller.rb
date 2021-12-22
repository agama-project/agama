class PropertiesController < ApplicationController
  def index
    render json: client.get_properties[0]
  end

  def show
    prop = client.get_property(params[:name])
    render json: prop[0]
  end

  def update
    client.set_property(params[:name], params[:value])
    render :ok
  rescue ::DBus::Error => e
    render json: { status: "error", message: e.message }
  end
end
