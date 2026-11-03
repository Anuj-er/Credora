const MAX_LOGO_BYTES = 128 * 1024;

const parseInstitutionLogo = (value) => {
  if (!value) return { dataUrl: null, buffer: null, hash: '' };
  if (typeof value !== 'string') throw Object.assign(new Error('Upload a PNG or JPEG university logo.'), { statusCode: 400 });

  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw Object.assign(new Error('Upload a PNG or JPEG university logo.'), { statusCode: 400 });

  const [, imageType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > MAX_LOGO_BYTES) {
    throw Object.assign(new Error('University logos must be 128 KB or smaller.'), { statusCode: 400 });
  }

  const validPng = imageType === 'png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const validJpeg = imageType === 'jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (!validPng && !validJpeg) {
    throw Object.assign(new Error('The logo file is not a valid PNG or JPEG image.'), { statusCode: 400 });
  }

  return {
    dataUrl: `data:image/${imageType};base64,${buffer.toString('base64')}`,
    buffer,
    hash: require('./credentialProof').sha256(buffer),
  };
};

module.exports = { MAX_LOGO_BYTES, parseInstitutionLogo };
