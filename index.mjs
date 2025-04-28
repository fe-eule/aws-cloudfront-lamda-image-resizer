import AWS from "aws-sdk";
import Sharp from "sharp";

const S3 = new AWS.S3({ region: "ap-northeast-2" });
const BUCKET = "your-bucket-name"; // Enter your bucket name here

const supportImageTypes = new Set([
  "auto",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "png",
]);

// Format initialization function
function initFormat(draftFormat, acceptHeader) {
  if (draftFormat === "auto") {
    if (acceptHeader.value.includes("avif")) return "avif";
    if (acceptHeader.value.includes("webp")) return "webp";
    return "jpeg";
  }
  return draftFormat === "jpg" ? "jpeg" : draftFormat;
}

// Common response handler
function responseHandler(
  response,
  { status, statusDescription, body, contentType, bodyEncoding }
) {
  response.status = status;
  response.statusDescription = statusDescription;
  response.body = body;
  if (contentType)
    response.headers["content-type"] = [
      { key: "Content-Type", value: contentType },
    ];
  if (bodyEncoding) response.bodyEncoding = bodyEncoding;
}

// Parse and validate request parameters
function parseRequestParams(request) {
  const { uri, querystring } = request;
  const params = querystring ? querystring.parse(querystring) : {};
  const objectKey = decodeURIComponent(uri).slice(1);

  // Parse params
  const width = params.width ? parseInt(params.width, 10) : null;
  const height = params.height ? parseInt(params.height, 10) : null;
  const quality = params.quality ? parseInt(params.quality, 10) : 100;
  const extension = uri.split(".").pop().toLowerCase();
  const lowerFormat = (params.format || extension).toLowerCase();

  return {
    objectKey,
    width,
    height,
    quality,
    extension,
    lowerFormat,
    hasResizingParams: !!(params.width || params.height),
    hasFormatParam: !!params.f,
  };
}

// Calculate dimensions for resizing
async function calculateResizeDimensions(
  sharpInstance,
  requestedWidth,
  requestedHeight
) {
  const metadata = await sharpInstance.metadata();
  let shouldResize = false;
  let finalWidth = requestedWidth;
  let finalHeight = requestedHeight;

  if (requestedWidth && requestedWidth > metadata.width) {
    finalWidth = metadata.width;
    console.log(
      `Requested width (${requestedWidth}) is larger than original (${metadata.width}). Using original width.`
    );
  } else if (requestedWidth) {
    shouldResize = true;
  }

  if (requestedHeight && requestedHeight > metadata.height) {
    finalHeight = metadata.height;
    console.log(
      `Requested height (${requestedHeight}) is larger than original (${metadata.height}). Using original height.`
    );
  } else if (requestedHeight) {
    shouldResize = true;
  }

  return {
    shouldResize,
    finalWidth,
    finalHeight,
    metadata,
  };
}

// Process image based on parameters
async function processImage(imageBody, params) {
  const { finalWidth, finalHeight, shouldResize, metadata } = params;
  const { quality, finalFormat } = params;

  const sharpInstance = Sharp(imageBody);

  let processedImage;
  if (shouldResize) {
    processedImage = await sharpInstance
      .rotate()
      .resize(finalWidth, finalHeight, { fit: "contain" })
      .toFormat(finalFormat, { quality })
      .toBuffer();
    console.log(`Image resized to ${finalWidth}x${finalHeight}`);
  } else {
    // If no resizing needed, just convert format if necessary
    if (finalFormat !== metadata.format) {
      processedImage = await sharpInstance
        .rotate()
        .toFormat(finalFormat, { quality })
        .toBuffer();
      console.log(`Image format converted to ${finalFormat} without resizing`);
    } else {
      // Use original image if no resizing or format conversion needed
      processedImage = imageBody;
      console.log("Using original image (no resizing needed)");
    }
  }

  return processedImage;
}

// Handle errors in image processing
function handleError(error, response) {
  console.error("Error occurred:", error);
  const status = error.code === "NoSuchKey" ? 404 : 500;
  const message =
    status === 404 ? "Image not found." : "Image processing failed.";

  responseHandler(response, {
    status,
    statusDescription: status === 404 ? "Not Found" : "Internal Server Error",
    body: message,
    contentType: "text/plain",
  });

  return response;
}

// Fetch image from S3
async function fetchImageFromS3(objectKey) {
  return await S3.getObject({
    Bucket: BUCKET,
    Key: objectKey,
  }).promise();
}

export const handler = async (event, context, callback) => {
  const { request, response } = event.Records[0].cf;

  // Parse request parameters
  const {
    objectKey,
    width,
    height,
    quality,
    extension,
    lowerFormat,
    hasResizingParams,
    hasFormatParam,
  } = parseRequestParams(request);

  // Return the original image if neither width nor height is provided
  if (!hasResizingParams) return callback(null, response);

  // Return the original image if it's a GIF and no format conversion is requested
  if (extension === "gif" && !hasFormatParam) return callback(null, response);

  const acceptHeader = request.headers?.accept;
  const finalFormat = initFormat(lowerFormat, acceptHeader);

  // Block unsupported formats
  if (!supportImageTypes.has(lowerFormat)) {
    responseHandler(response, {
      status: 403,
      statusDescription: "Forbidden",
      body: "Unsupported image type",
      contentType: "text/plain",
    });
    return callback(null, response);
  }

  try {
    // Fetch the object from S3
    const { Body } = await fetchImageFromS3(objectKey);

    // Create Sharp instance and get dimensions
    const sharpInstance = Sharp(Body);
    const { shouldResize, finalWidth, finalHeight, metadata } =
      await calculateResizeDimensions(sharpInstance, width, height);

    // Process the image
    const processedImage = await processImage(Body, {
      finalWidth,
      finalHeight,
      shouldResize,
      metadata,
      quality,
      finalFormat,
    });

    // Successful response
    responseHandler(response, {
      status: 200,
      statusDescription: "OK",
      body: processedImage.toString("base64"),
      contentType: `image/${finalFormat}`,
      bodyEncoding: "base64",
    });

    console.log("Image processing successful");
  } catch (error) {
    handleError(error, response);
  }

  return callback(null, response);
};
