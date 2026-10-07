package com.clinora.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GeminiStartupCheck implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(GeminiStartupCheck.class);

    @Value("${clinora.health-summary.gemini.api-key:${GEMINI_API_KEY:}}")
    private String geminiApiKey;

    @Override
    public void run(String... args) {
        if (geminiApiKey == null || geminiApiKey.trim().isEmpty()) {
            logger.warn("Gemini API key loaded: false (GEMINI_API_KEY is missing, AI features will be unavailable)");
        } else {
            logger.info("Gemini API key loaded: true (length: {})", geminiApiKey.length());
        }
    }
}
