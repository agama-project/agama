class CallsController < ApplicationController
  def create
    ret = client.call(params[:meth])
    render json: ret[0]
  end
end
