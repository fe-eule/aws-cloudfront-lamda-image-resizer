FROM node:18-alpine

# Install dependencies required by the Sharp library
RUN apk add --no-cache \
    build-base \
    python3 \
    g++ \
    make

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Set environment variables for testing
ENV AWS_REGION=ap-northeast-2
ENV S3_BUCKET=your-bucket-name
ENV NODE_ENV=development

# AWS settings for local testing (use IAM roles for actual deployment)
# Uncomment the lines below and provide values to use AWS credentials
# ENV AWS_ACCESS_KEY_ID=your_access_key
# ENV AWS_SECRET_ACCESS_KEY=your_secret_key

# Create a directory to store test images
RUN mkdir -p /app/test-images

# Expose a port for testing (if needed)
EXPOSE 9000

# Install tools for local Lambda function testing
RUN npm install -g aws-lambda-local

# Set the default command for testing
CMD ["node", "-e", "console.log('Lambda Image Resizer environment is ready. Start testing.')"]

# Example commands for testing:
# docker build -t lambda-image-resizer .
# docker run -it -v $(pwd)/test-images:/app/test-images lambda-image-resizer /bin/sh
#
# Run tests inside the container:
# aws-lambda-local -l index.mjs -h handler -e test-event.json