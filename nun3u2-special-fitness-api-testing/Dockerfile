FROM node:18-slim
WORKDIR /app
COPY . /app

# Install root-level deps (meta-tests + evaluation)
RUN npm install --legacy-peer-deps

# Install repository_after deps (primary tests)
RUN cd repository_after && npm install --legacy-peer-deps

ENTRYPOINT ["npm", "run"]
