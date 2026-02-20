FROM node:22
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x deploy.sh
CMD ["sh", "-c", "./deploy.sh"]
