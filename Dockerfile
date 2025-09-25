# Gunakan Node.js versi LTS
FROM node:20

# Set working directory di container
WORKDIR /app

# Copy package.json dan package-lock.json (kalau ada)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy seluruh source code
COPY . .

# Expose port backend
EXPOSE 3000

# Jalankan server (default ke npm start, bisa diganti lewat docker-compose)
CMD ["npm", "start"]
