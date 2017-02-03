FROM node

MAINTAINER Reekoh

WORKDIR /home

# Install dependencies
ADD . /home
RUN npm install

# setting need environment variables
ENV PLUGIN_ID="demo.device-sync" \
    CONFIG="{}" \
    LOGGERS="" \
    EXCEPTION_LOGGERS="" \
    BROKER="amqp://guest:guest@172.17.0.2/"

CMD ["node", "app"]