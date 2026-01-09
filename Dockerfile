FROM node:20.19.5-alpine3.22

WORKDIR /usr/src/app

COPY . .

RUN npm install && \
    npm cache clean --force

EXPOSE 5000

CMD ["node", "index.js"]
