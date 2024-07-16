import querystring from "querystring"; // Don't install.
import AWS from "aws-sdk";

import Sharp from "sharp";

const S3 = new AWS.S3({
  region: "ap-northeast-2",
});

const BUCKET = "your-bucket-name"; // Input your bucket

// Image types that can be handled by Sharp
const supportImageTypes = ["auto", "jpg", "jpeg", "webp", "avif", "png"];

function initFormat(draftFormat, acceptHeader) {
  switch (draftFormat) {
    case "auto":
      if (acceptHeader) {
        if (acceptHeader.value.includes("avif")) {
          return "avif";
        } else if (acceptHeader.value.includes("webp")) {
          return "webp";
        }
      } else {
        return "jpeg";
      }

      break;

    case "jpg":
      return "jpeg";

    default:
      return draftFormat;
  }
}

export const handler = async (event, context, callback) => {
  let s3Object;
  let resizedImage;

  const { request, response } = event.Records[0].cf;
  const { uri } = request;
  const params = querystring.parse(request.querystring);
  const ObjectKey = decodeURIComponent(uri).substring(1);

  // If there is no width or height, return the original image.
  if (!(params.width || params.height)) {
    return callback(null, response);
  }

  const width = parseInt(params.width, 10) || null;
  const height = parseInt(params.height, 10) || null;
  // Sharp has different default values for quality depending on the image format.
  // https://sharp.pixelplumbing.com/api-output#toformat
  const quality = parseInt(params.quality, 10) || 100;
  const extension = uri.match(/\/?(.*)\.(.*)/)[2].toLowerCase();
  console.log("extension : ", extension);

  // Return the original if there is no format conversion for GIF format requests.
  if (extension === "gif" && !params.f) {
    return callback(null, response);
  }

  const lowerCaseFormat = (params.format || extension).toLowerCase();
  const acceptHeader = request.headers["accept"];
  const finalFormat = initFormat(lowerCaseFormat, acceptHeader);

  if (!supportImageTypes.some((type) => type === extension)) {
    responseHandler(403, "Forbidden", "Unsupported image type", [
      {
        key: "Content-Type",
        value: "text/plain",
      },
    ]);
    return callback(null, response);
  }

  // Verify For AWS CloudWatch.
  console.log(`params: ${JSON.stringify(params)}`); // Cannot convert object to primitive value.\
  console.log("S3 Object key:", ObjectKey);
  console.log("Bucket name : ", BUCKET);

  try {
    s3Object = await S3.getObject({
      Bucket: BUCKET,
      Key: ObjectKey,
    }).promise();

    console.log("S3 Object:", s3Object);
  } catch (error) {
    console.log("S3.getObject error : ", error);
    responseHandler(404, "Not Found", "OMG... The image does not exist.", [
      { key: "Content-Type", value: "text/plain" },
    ]);
    return callback(null, response);
  }

  try {
    /**
     * @reference http://sharp.pixelplumbing.com/en/stable/api-resize/
     */
    resizedImage = await Sharp(s3Object.Body)
      .rotate()
      .resize(width, height, { fit: "contain" })
      .toFormat(finalFormat, {
        quality,
      })
      .toBuffer();
  } catch (error) {
    console.log("Sharp error : ", error);
    responseHandler(500, "Internal Server Error", "Fail to resize image.", [
      {
        key: "Content-Type",
        value: "text/plain",
      },
    ]);
    return callback(null, response);
  }

  responseHandler(
    200,
    "OK",
    resizedImage.toString("base64"),
    [
      {
        key: "Content-Type",
        value: `image/${finalFormat}`,
      },
    ],
    "base64"
  );

  function responseHandler(
    status,
    statusDescription,
    body,
    contentHeader,
    bodyEncoding
  ) {
    response.status = status;
    response.statusDescription = statusDescription;
    response.body = body;
    response.headers["content-type"] = contentHeader;
    if (bodyEncoding) {
      response.bodyEncoding = bodyEncoding;
    }
  }

  console.log("Success resizing image");

  return callback(null, response);
};
