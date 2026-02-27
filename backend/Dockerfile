FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# prisma generate sera lancé au démarrage via docker-compose
# car le volume mount écrase /app avec les sources locales

CMD ["npm", "run", "start:dev"]