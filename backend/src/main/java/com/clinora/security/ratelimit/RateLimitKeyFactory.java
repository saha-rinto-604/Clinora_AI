package com.clinora.security.ratelimit;

import com.clinora.config.AuthProperties;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public class RateLimitKeyFactory {

    private final byte[] secret;

    public RateLimitKeyFactory(AuthProperties authProperties) {
        this.secret = authProperties.getRateLimitKeySecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("Rate-limit key secret must be at least 32 bytes");
        }
    }

    public String create(String bucket, String subject) {
        if (bucket == null || bucket.isBlank() || subject == null || subject.isBlank()) {
            throw new IllegalArgumentException("Rate-limit bucket and subject are required");
        }
        return "clinora:ratelimit:" + bucket + ":" + hmac(subject);
    }

    private String hmac(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) {
            throw new IllegalStateException("Unable to create rate-limit key", exception);
        }
    }
}
