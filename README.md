# aws-cloundfront-lamda-image-resizer

This is a simple example of how to use AWS Lambda to resize images on the fly using Amazon CloudFront.

## How it works

1. The user requests an image from CloudFront.
2. CloudFront forwards the request to the Lambda function.
3. The Lambda function resizes the image and returns it to CloudFront.
4. CloudFront caches the image and returns it to the user.
5. The next time the same image is requested, CloudFront returns the cached image.
6. If the image is updated, the cache is invalidated and the process starts over.
7. The Lambda function is only invoked when the image is requested for the first time or when the cache is invalidated.

## AWS setup
