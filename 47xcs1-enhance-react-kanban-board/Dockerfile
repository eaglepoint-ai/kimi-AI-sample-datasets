FROM node:18-slim

WORKDIR /app

# Copy everything
COPY . /app

# Install dependencies for repository_after
RUN cd repository_after && npm install --legacy-peer-deps

# Install additional test dependencies that aren't in the original package.json
RUN cd repository_after && npm install --save-dev @testing-library/dom@^9.3.4 --legacy-peer-deps

# Copy test files into repository_after/src/__tests__/ and fix import paths
RUN mkdir -p repository_after/src/__tests__ && \
    mkdir -p repository_after/src/__mocks__ && \
    echo "module.exports = {};" > repository_after/src/__mocks__/styleMock.js && \
    for f in tests/*.test.js tests/*.test.jsx; do \
      [ -f "$f" ] || continue; \
      basename=$(basename "$f"); \
      sed -e 's|from "../repository_after/src/App"|from "../App"|g' \
          -e 's|"../repository_after/package.json"|"../../package.json"|g' \
          -e 's|"../repository_after/src"|".."|g' \
          "$f" > "repository_after/src/__tests__/$basename"; \
    done

# Default command runs evaluation
CMD ["node", "evaluation/evaluation.js"]
