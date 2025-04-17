ARG ENV=prod
FROM node:20-alpine as node
FROM nginxinc/nginx-unprivileged:1-alpine-slim as nginx

FROM node as aggregator 
RUN mkdir -p /tmp/reveal /dist/scripts
# Install dependencies first -> More effective docker build cache
COPY package.json package-lock.json /tmp/reveal/
# Speed up build by removing dependencies that are large and not needed for this use case
# qunit -> pupeteer -> chrome
WORKDIR /tmp/reveal
RUN sed -i '/^.*node-qunit-puppeteer.*$/d' package.json
RUN npm install

# Copy remaining web resources later for better caching
COPY . /tmp/reveal/
RUN mv scripts/src/* /dist/scripts/ && \
    rm -rf scripts
# Remove qunite dependency (see above)
RUN sed -i '/^const qunit.*$/d' gulpfile.js
RUN stat "/tmp/reveal/index.ejs"

FROM aggregator AS dev-aggregator
WORKDIR /tmp/reveal
RUN mkdir -p /tmp/reveal/images/ && echo "image directory made"
# Build minified js, css, copy plugins, etc. 
RUN node_modules/gulp/bin/gulp.js build
RUN mv /tmp/reveal /dist/reveal
# For some reasons libintl is only needed by envsubst in dev
RUN mkdir -p /dist/lib/ 
RUN cp /usr/lib/libintl.so.8 /dist/lib/

FROM node AS dev
RUN cd /scripts && npm i --save ejs
COPY --from=dev-aggregator /dist /
EXPOSE 8000
EXPOSE 35729
ENTRYPOINT [ "/scripts/entrypoint.sh", "npm", "run", "start", "--prefix", "/reveal/"]


FROM aggregator AS prod-aggregator
WORKDIR /tmp/reveal
RUN mkdir -p /dist/usr/share/nginx/ /dist/reveal/ /tmp/reveal/images
# Don't forget to add our custom plugin/libs
RUN  node_modules/gulp/bin/gulp.js fontawesome twemoji
# Package only whats necessary for static website
RUN node_modules/gulp/bin/gulp.js package
RUN unzip reveal-js-presentation.zip -d /dist/reveal/
# Serve web content at same folder in dev and prod: /reveal. This does not work with buildkit.
RUN ln -s /reveal /dist/usr/share/nginx/html


FROM nginx AS prod
USER root
RUN apk add --update nodejs npm && cd /scripts && npm i --save ejs
COPY --from=prod-aggregator --chown=nginx /dist /
EXPOSE 8080
ENTRYPOINT [ "/scripts/entrypoint.sh", "nginx", "-g", "daemon off;"]

# Pick final image according to build-arg
FROM ${ENV}
