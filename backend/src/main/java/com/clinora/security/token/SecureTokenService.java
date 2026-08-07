package com.clinora.security.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Service;

@Service
public class SecureTokenService {

    private static final int TOKEN_BYTES = 32;
    private final SecureRandom secureRandom = new SecureRandom();

    public GeneratedSecureToken generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        return new GeneratedSecureToken(raw, hash(raw));
    }

    public String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public boolean hashesMatch(String firstHash, String secondHash) {
        if (firstHash == null || secondHash == null) {
            return false;
        }
        return MessageDigest.isEqual(
            firstHash.getBytes(StandardCharsets.US_ASCII),
            secondHash.getBytes(StandardCharsets.US_ASCII)
        );
    }
}
