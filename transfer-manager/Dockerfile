# Build step
FROM node:12.17-alpine AS wallet-manager-prebuild

RUN apk --update add git openssh && \
    rm -rf /var/lib/apt/lists/* && \
    rm /var/cache/apk/*

# Install node_modules
ADD package.json package-lock.json /tmp/
RUN cd /tmp && npm i
RUN mkdir -p /usr/src/app && cp -a /tmp/node_modules /usr/src/app

# Define workdir
WORKDIR /usr/src/app
COPY package.json /usr/src/app
COPY src /usr/src/app/src

###################################################################

# Final step
FROM node:12.17-alpine

# Get files from build step
COPY --from=wallet-manager-prebuild /usr/src/app /usr/src/app

# Define bot as workdir
WORKDIR /usr/src/app

# Expose bot port
EXPOSE 8080
