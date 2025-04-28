# aws-cloudfront-lambda-image-resizer

This is a simple example of how to use AWS Lambda to resize images on the fly using Amazon CloudFront.

## Why use this?

- Low-resolution images on high-resolution displays create a bad user experience.
- High-resolution images on low-resolution displays waste bandwidth, device, and server resources, especially when using a framework that adopts images in-app and crops or resizes images, making the app heavy.

## How to use

Add query parameters. That's it.

- width
- height
- format ('auto' option checks the Accept request header)
- quality (0~100, default: 100)

### Request image example

- https://your-domain/images/hangang-river.jpeg?width=1100 (940KB)
- https://your-domain/images/hangang-river.jpeg?width=1100&format=webp (658KB)

<img width="480" alt="image" src="https://github.com/user-attachments/assets/259a368a-12db-4bb4-96dc-68c0beeca993">

## How it works

1. The user requests an image from CloudFront.
2. CloudFront forwards the request to the Lambda function.
3. The Lambda function resizes the image and returns it to CloudFront.
4. CloudFront caches the image and returns it to the user.
5. The next time the same image is requested, CloudFront returns the cached image.
6. If the image is updated, the cache is invalidated and the process starts over.
7. The Lambda function is only invoked when the image is requested for the first time or when the cache is invalidated.

## How to test

1. Build the Docker image:

```bash
docker build -t lambda-image-resizer .
```

2. Create a directory to store test images and run the Docker container:

```bash
mkdir -p test-images
docker run -it -v $(pwd)/test-images:/app/test-images lambda-image-resizer /bin/sh
```

3. After accessing the container, you can run the test as follows:

```bash
aws-lambda-local -l index.mjs -h handler -e test-event.json
```

### Configuration

- Modify the following environment variables in the Dockerfile if needed:
  - AWS_REGION: AWS region
  - S3_BUCKET: S3 bucket name
  - If AWS credentials are required, uncomment the relevant section and provide the values.
- To test with actual images, place test image files in the `test-images` directory and update the URI path in `test-event.json` to match the image file path.

This test environment allows you to test the Lambda function's image processing logic locally without connecting to actual AWS resources. To connect to a real S3 bucket, set up appropriate AWS credentials.

## AWS setup

> Create a Lambda function (choose us-east-1 to use the CloudFront response trigger)

<img width="870" alt="iShot_2024-07-16_09 13 55" src="https://github.com/user-attachments/assets/0d9fbb2f-8e80-4367-98d9-728bc847efc7">

> Create a Cloud9 environment for writing the Lambda function source code

<img width="870" alt="image" src="https://github.com/user-attachments/assets/dafcc477-d42d-4217-a64b-fd819885ba66">

> Write the Lambda function

Write the code (See this repository's source code)

<img width="870" alt="image" src="https://github.com/user-attachments/assets/6c21d91c-7cde-44a6-80d0-15e907d89694">

> Upload the Lambda function

<img width="450" alt="image" src="https://github.com/user-attachments/assets/31fcf3e0-cda4-4e08-8bd1-fa62ad8f1095">

Select "Directory" -> "No" -> Select the project folder -> Open (after a few minutes, a completion message will appear)

> Add a Trigger

<img width="870" alt="iShot_2024-07-16_09 14 17" src="https://github.com/user-attachments/assets/d2396240-8b91-44e9-8b0d-d0d8e5e3b115">

> Deploy

<img width="870" alt="iShot_2024-07-16_09 13 23" src="https://github.com/user-attachments/assets/38ecbbbe-57ba-445d-9f1e-ba84a1a0a2ce">
