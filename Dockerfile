FROM node:22-alpine

WORKDIR /app

COPY . .

RUN mkdir -p /app/data

ENV PORT=80

EXPOSE 80

CMD ["node", "server.js"]
