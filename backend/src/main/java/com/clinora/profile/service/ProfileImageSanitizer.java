package com.clinora.profile.service;

import com.clinora.patients.api.PatientApiException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.geom.AffineTransform;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class ProfileImageSanitizer {
    static final int MAX_DIMENSION = 4096;
    static final long MAX_PIXELS = 16_777_216L;

    public SanitizedImage sanitize(byte[] source) {
        String mime = detectMime(source);
        return switch (mime) {
            case "image/jpeg" -> sanitizeRaster(source, mime, "jpg", jpegOrientation(source));
            case "image/png" -> sanitizeRaster(source, mime, "png", 1);
            case "image/webp" -> sanitizeWebp(source);
            default -> throw invalid("PROFILE_IMAGE_TYPE_INVALID", "Choose a JPEG, PNG, or WebP image.");
        };
    }

    private SanitizedImage sanitizeRaster(byte[] source, String mime, String format, int orientation) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(source))) {
            if (input == null) throw invalid("PROFILE_IMAGE_INVALID", "The image could not be read.");
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw invalid("PROFILE_IMAGE_INVALID", "The image could not be read.");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                validateDimensions(width, height);
                BufferedImage decoded = reader.read(0);
                if (decoded == null) throw invalid("PROFILE_IMAGE_INVALID", "The image could not be read.");
                BufferedImage normalized = orient(decoded, orientation);
                validateDimensions(normalized.getWidth(), normalized.getHeight());
                byte[] bytes = writeRaster(normalized, format);
                return new SanitizedImage(bytes, mime, normalized.getWidth(), normalized.getHeight(), format);
            } finally {
                reader.dispose();
            }
        } catch (PatientApiException exception) {
            throw exception;
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof PatientApiException patientApiException) throw patientApiException;
            throw invalid("PROFILE_IMAGE_INVALID", "The image could not be processed safely.");
        }
    }

    private static byte[] writeRaster(BufferedImage image, String format) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if ("jpg".equals(format)) {
            BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = rgb.createGraphics();
            try {
                graphics.drawImage(image, 0, 0, null);
            } finally {
                graphics.dispose();
            }
            ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
            try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(out)) {
                writer.setOutput(imageOutput);
                ImageWriteParam params = writer.getDefaultWriteParam();
                if (params.canWriteCompressed()) {
                    params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                    params.setCompressionQuality(0.90f);
                }
                writer.write(null, new IIOImage(rgb, null, null), params);
            } finally {
                writer.dispose();
            }
        } else if (!ImageIO.write(image, format, out)) {
            throw new IOException("Image writer unavailable");
        }
        return out.toByteArray();
    }

    private static BufferedImage orient(BufferedImage source, int orientation) {
        if (orientation <= 1 || orientation > 8) return source;
        int sourceWidth = source.getWidth();
        int sourceHeight = source.getHeight();
        boolean swap = orientation >= 5 && orientation <= 8;
        int targetWidth = swap ? sourceHeight : sourceWidth;
        int targetHeight = swap ? sourceWidth : sourceHeight;
        BufferedImage target = new BufferedImage(targetWidth, targetHeight, bufferedType(source));
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            AffineTransform transform = switch (orientation) {
                case 2 -> new AffineTransform(-1, 0, 0, 1, sourceWidth, 0);
                case 3 -> new AffineTransform(-1, 0, 0, -1, sourceWidth, sourceHeight);
                case 4 -> new AffineTransform(1, 0, 0, -1, 0, sourceHeight);
                case 5 -> new AffineTransform(0, 1, 1, 0, 0, 0);
                case 6 -> new AffineTransform(0, 1, -1, 0, sourceHeight, 0);
                case 7 -> new AffineTransform(0, -1, -1, 0, sourceHeight, sourceWidth);
                case 8 -> new AffineTransform(0, -1, 1, 0, 0, sourceWidth);
                default -> new AffineTransform();
            };
            graphics.drawImage(source, transform, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private static int bufferedType(BufferedImage source) {
        return source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
    }

    private SanitizedImage sanitizeWebp(byte[] source) {
        if (source.length < 20 || !ascii(source, 0, "RIFF") || !ascii(source, 8, "WEBP")) {
            throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
        }
        long declared = unsignedIntLE(source, 4) + 8L;
        if (declared != source.length) throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");

        int width = -1;
        int height = -1;
        boolean hasImagePayload = false;
        List<WebpChunk> chunks = new ArrayList<>();
        int offset = 12;
        while (offset + 8 <= source.length) {
            String type = new String(source, offset, 4, java.nio.charset.StandardCharsets.US_ASCII);
            int length = intLE(source, offset + 4);
            if (length < 0) throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
            int dataStart = offset + 8;
            long dataEndLong = (long) dataStart + length;
            if (dataEndLong > source.length) throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
            int dataEnd = (int) dataEndLong;
            if ("ANIM".equals(type) || "ANMF".equals(type)) {
                throw invalid("PROFILE_IMAGE_ANIMATED", "Animated WebP images are not supported for profile photos.");
            }
            byte[] data = Arrays.copyOfRange(source, dataStart, dataEnd);
            if ("VP8X".equals(type)) {
                if (data.length < 10) throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
                if ((data[0] & 0x02) != 0) {
                    throw invalid("PROFILE_IMAGE_ANIMATED", "Animated WebP images are not supported for profile photos.");
                }
                data[0] = (byte) (data[0] & ~0x0C); // remove EXIF/XMP feature flags with their chunks
                width = onePlus24(data, 4);
                height = onePlus24(data, 7);
            } else if ("VP8L".equals(type)) {
                if (data.length < 5 || (data[0] & 0xff) != 0x2f) throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
                int b1 = data[1] & 0xff;
                int b2 = data[2] & 0xff;
                int b3 = data[3] & 0xff;
                int b4 = data[4] & 0xff;
                width = 1 + (b1 | ((b2 & 0x3f) << 8));
                height = 1 + (((b2 & 0xc0) >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10));
                hasImagePayload = true;
            } else if ("VP8 ".equals(type)) {
                if (data.length < 10 || (data[3] & 0xff) != 0x9d || (data[4] & 0xff) != 0x01 || (data[5] & 0xff) != 0x2a) {
                    throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
                }
                width = ((data[7] & 0x3f) << 8) | (data[6] & 0xff);
                height = ((data[9] & 0x3f) << 8) | (data[8] & 0xff);
                hasImagePayload = true;
            }
            if ("VP8 ".equals(type) || "VP8L".equals(type)) hasImagePayload = true;
            if (!"EXIF".equals(type) && !"XMP ".equals(type)) chunks.add(new WebpChunk(type, data));
            offset = dataEnd + (length & 1);
        }
        if (offset != source.length || !hasImagePayload || width <= 0 || height <= 0) {
            throw invalid("PROFILE_IMAGE_INVALID", "The WebP image is malformed.");
        }
        validateDimensions(width, height);

        ByteArrayOutputStream body = new ByteArrayOutputStream();
        try {
            body.write("WEBP".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            for (WebpChunk chunk : chunks) {
                body.write(chunk.type().getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                writeIntLE(body, chunk.data().length);
                body.write(chunk.data());
                if ((chunk.data().length & 1) == 1) body.write(0);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            writeIntLE(out, body.size());
            body.writeTo(out);
            return new SanitizedImage(out.toByteArray(), "image/webp", width, height, "webp");
        } catch (IOException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static void validateDimensions(int width, int height) {
        long pixels = (long) width * height;
        if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION || pixels > MAX_PIXELS) {
            throw invalid("PROFILE_IMAGE_DIMENSIONS_INVALID", "Profile images may be up to 4096 by 4096 pixels.");
        }
    }

    static String detectMime(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (bytes.length >= 8 && (bytes[0] & 0xff) == 0x89 && ascii(bytes, 1, "PNG") && (bytes[4] & 0xff) == 0x0d && (bytes[5] & 0xff) == 0x0a && (bytes[6] & 0xff) == 0x1a && (bytes[7] & 0xff) == 0x0a) {
            return "image/png";
        }
        if (bytes.length >= 12 && ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";
        return "application/octet-stream";
    }

    private static int jpegOrientation(byte[] bytes) {
        int offset = 2;
        while (offset + 4 <= bytes.length && (bytes[offset] & 0xff) == 0xff) {
            int marker = bytes[offset + 1] & 0xff;
            offset += 2;
            if (marker == 0xd8 || marker == 0x01) continue;
            if (marker == 0xd9 || marker == 0xda) break;
            if (offset + 2 > bytes.length) break;
            int length = ((bytes[offset] & 0xff) << 8) | (bytes[offset + 1] & 0xff);
            if (length < 2 || offset + length > bytes.length) break;
            if (marker == 0xe1 && length >= 10 && ascii(bytes, offset + 2, "Exif\0\0")) {
                int orientation = parseExifOrientation(bytes, offset + 8, length - 8);
                if (orientation >= 1 && orientation <= 8) return orientation;
            }
            offset += length;
        }
        return 1;
    }

    private static int parseExifOrientation(byte[] bytes, int tiff, int available) {
        if (available < 8 || tiff < 0 || tiff + available > bytes.length) return 1;
        boolean little;
        if (bytes[tiff] == 'I' && bytes[tiff + 1] == 'I') little = true;
        else if (bytes[tiff] == 'M' && bytes[tiff + 1] == 'M') little = false;
        else return 1;
        ByteOrder order = little ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;
        ByteBuffer buffer = ByteBuffer.wrap(bytes, tiff, available).slice().order(order);
        if ((buffer.getShort(2) & 0xffff) != 42) return 1;
        long ifdOffset = buffer.getInt(4) & 0xffffffffL;
        if (ifdOffset + 2 > available) return 1;
        int ifd = (int) ifdOffset;
        int entries = buffer.getShort(ifd) & 0xffff;
        for (int index = 0; index < entries; index++) {
            int entry = ifd + 2 + index * 12;
            if (entry + 12 > available) return 1;
            int tag = buffer.getShort(entry) & 0xffff;
            if (tag == 0x0112) return buffer.getShort(entry + 8) & 0xffff;
        }
        return 1;
    }

    private static boolean ascii(byte[] source, int offset, String text) {
        if (offset < 0 || offset + text.length() > source.length) return false;
        for (int index = 0; index < text.length(); index++) {
            if ((byte) text.charAt(index) != source[offset + index]) return false;
        }
        return true;
    }

    private static long unsignedIntLE(byte[] source, int offset) {
        return intLE(source, offset) & 0xffffffffL;
    }

    private static int intLE(byte[] source, int offset) {
        if (offset < 0 || offset + 4 > source.length) return -1;
        return (source[offset] & 0xff)
            | ((source[offset + 1] & 0xff) << 8)
            | ((source[offset + 2] & 0xff) << 16)
            | ((source[offset + 3] & 0xff) << 24);
    }

    private static int onePlus24(byte[] source, int offset) {
        return 1 + (source[offset] & 0xff) + ((source[offset + 1] & 0xff) << 8) + ((source[offset + 2] & 0xff) << 16);
    }

    private static void writeIntLE(ByteArrayOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >>> 8) & 0xff);
        out.write((value >>> 16) & 0xff);
        out.write((value >>> 24) & 0xff);
    }

    private static PatientApiException invalid(String code, String message) {
        return new PatientApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public record SanitizedImage(byte[] bytes, String contentType, int width, int height, String extension) {}
    private record WebpChunk(String type, byte[] data) {}
}
