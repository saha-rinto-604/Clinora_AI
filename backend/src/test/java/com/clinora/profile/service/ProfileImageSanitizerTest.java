package com.clinora.profile.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.clinora.patients.api.PatientApiException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class ProfileImageSanitizerTest {
    private final ProfileImageSanitizer sanitizer = new ProfileImageSanitizer();

    @Test
    void sanitizesPngIntoAValidatedRaster() throws Exception {
        BufferedImage image = new BufferedImage(4, 3, BufferedImage.TYPE_INT_ARGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);

        var sanitized = sanitizer.sanitize(bytes.toByteArray());

        assertEquals("image/png", sanitized.contentType());
        assertEquals(4, sanitized.width());
        assertEquals(3, sanitized.height());
        assertTrue(sanitized.bytes().length > 0);
        assertEquals("image/png", ProfileImageSanitizer.detectMime(sanitized.bytes()));
    }

    @Test
    void rejectsFilenameIndependentUnsupportedContent() {
        PatientApiException exception = assertThrows(
            PatientApiException.class,
            () -> sanitizer.sanitize("GIF89a-not-a-supported-profile-photo".getBytes())
        );
        assertEquals("PROFILE_IMAGE_TYPE_INVALID", exception.getErrorCode());
    }

    @Test
    void rejectsOversizedDecodedDimensionsBeforeAcceptingRaster() throws Exception {
        BufferedImage image = new BufferedImage(4100, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);

        PatientApiException exception = assertThrows(PatientApiException.class, () -> sanitizer.sanitize(bytes.toByteArray()));
        assertEquals("PROFILE_IMAGE_DIMENSIONS_INVALID", exception.getErrorCode());
    }
}
