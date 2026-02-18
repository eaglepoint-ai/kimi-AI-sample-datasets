FROM node:20-bullseye

# Install Playwright system dependencies
RUN npx playwright install-deps chromium

WORKDIR /app

COPY . .

# Install all dependencies (backend, frontend, tests)
RUN npm install --prefix repository_after/backend
RUN npm install --prefix repository_after/frontend
RUN npm install --prefix tests

# Install Playwright browsers for e2e tests
RUN cd tests && npx playwright install chromium

# Build backend and frontend
RUN npm run build --prefix repository_after/backend
RUN npm run build --prefix repository_after/frontend

CMD ["bash"]
