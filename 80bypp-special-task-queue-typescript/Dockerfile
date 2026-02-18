FROM node:20-slim

WORKDIR /app

COPY package*.json tsconfig.json ./

RUN npm install --include=dev --no-audit --no-fund && npm cache clean --force

RUN npx jest --version

COPY repository_before/ ./repository_before/
COPY repository_after/ ./repository_after/
COPY tests/ ./tests/
COPY evaluation/ ./evaluation/

ENV NODE_ENV=test

CMD ["npm", "test"]
