FROM node:latest

WORKDIR /usr/src/app

COPY . .

RUN npm install && \
    npm cache clean --force

EXPOSE 5000

CMD ["node", "index.js"]
