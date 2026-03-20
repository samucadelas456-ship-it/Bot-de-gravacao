FROM node:18-slim

# Instalar dependências necessárias
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json ./
COPY .npmrc ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Criar diretório para gravações
RUN mkdir -p recordings

CMD ["node", "index.js"]
